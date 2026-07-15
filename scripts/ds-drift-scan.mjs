#!/usr/bin/env node
// Scheduled drift detector: notice an in-app retheme within days (GOL-411).
//
// The GOL-402 guard already refuses to clobber a retheme — but it only fires
// when someone happens to push. If Abigail rethemes a brand in the Claude Design
// app the day after our last push, nothing tells us until the next push attempt,
// which could be a month later. This scans on a schedule and opens an issue, so
// the gap between "a human changed the brand" and "we know about it" is days.
//
// ── Why this is a routine and not a CI job ────────────────────────────────
//
// Reading the published side needs a DesignSync `get_file` call, and DesignSync
// authenticates through a claude.ai login that a GitHub Actions runner does not
// have and cannot obtain — there is no API key or CLI to hand it. So the fetch
// half is impossible in CI. A Paperclip routine wakes an agent that DOES hold
// that auth. This script is the deterministic half of that split, exactly like
// ds-guard.mjs: no network, so a scheduled run and a local run can never
// disagree about what "diverged" means.
//
// ── Why it opens an issue instead of failing a build ──────────────────────
//
// Published values change out-of-band, by a human, on their schedule. A gate
// that reddens unrelated PRs when Abigail picks a new gold would be muted within
// a week, and a muted detector is worse than none: it reads as coverage while
// detecting nothing. An issue is the honest shape — it routes to a person and
// waits, without blocking anyone else's work.
//
// ── What it does NOT do ───────────────────────────────────────────────────
//
// This is a detector. It fires AFTER a retheme, and it cannot prevent a clobber
// — ds-guard.mjs (GOL-402) is the thing that does that, and it is the one that
// matters. This only shortens the time to notice. Do not let its presence
// justify weakening the guard.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//
//   node scripts/ds-drift-scan.mjs --published-dir .ds-sync/published
//
// The agent fetches each brand's published bundle into
// <published-dir>/<brand>/_ds_bundle.css first, then runs this. Emits a JSON
// report on stdout describing what (if anything) to open an issue about.
//
// Exit codes: 0 = scan completed (read `drifted` in the report to decide what to
// do) · 2 = the scan itself is broken and its silence must not be trusted.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS = ['goldberry', 'ggg', 'nursery', 'hub'];

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };

const publishedDir = resolve(ROOT, flag('published-dir', '.ds-sync/published'));

const report = { scannedAt: null, drifted: [], clean: [], uncovered: [], notFetched: [], broken: [] };

for (const brand of BRANDS) {
  const publishedPath = join(publishedDir, brand, '_ds_bundle.css');
  const baselinePath = join(ROOT, '.design-sync', `baseline.${brand}.json`);

  // A brand with no baseline is NOT covered by this scan, and saying so out loud
  // is the whole point of this branch. ds-guard would happily fall back to
  // diffing the repo artifact — but repo-vs-published differs on every brand we
  // have legitimately changed and not yet pushed, so on a schedule that fallback
  // fires forever and trains everyone to ignore the issue it opens. Reporting
  // "uncovered" is honest; a permanently-red detector is not.
  //
  // ggg and nursery are the live case: their published palettes have circular
  // provenance (GOL-404), so adopting a baseline for them would ARM a clobber
  // rather than prevent one. They stay uncovered until Abigail confirms which
  // values are hers. That is a brand decision, not a scheduling one.
  if (!existsSync(baselinePath)) {
    report.uncovered.push({ brand, why: `no .design-sync/baseline.${brand}.json — nothing to compare against` });
    continue;
  }
  if (!existsSync(publishedPath)) {
    // Distinct from "clean": the agent's fetch step didn't land this brand. If
    // this were folded into clean, a silently-failing fetch would read as "no
    // drift" — absence of evidence becoming evidence of safety, which is the
    // exact failure ds-guard refuses to make.
    report.notFetched.push({ brand, why: `no published bundle at ${publishedPath} — the fetch step did not run or failed` });
    continue;
  }

  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'ds-guard.mjs'), '--brand', brand, '--published', publishedPath], { encoding: 'utf8' });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();

  if (run.status === 0) { report.clean.push({ brand }); continue; }
  if (run.status === 1) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    report.drifted.push({ brand, projectId: baseline.projectId, adoptedAt: baseline.adoptedAt, detail: output });
    continue;
  }
  // Exit 2 (usage/unreadable/not-a-bundle) means the scan could not form an
  // opinion. Surfacing it as its own bucket keeps a broken scan from being
  // indistinguishable from a quiet one.
  report.broken.push({ brand, status: run.status, detail: output });
}

// The fingerprint is what stops the routine reopening the same issue every run.
// It keys on WHICH brands drifted, not on the token values: while a retheme is
// waiting for a brand-owner decision, Abigail may keep editing, and a
// value-keyed fingerprint would open a fresh issue on every tweak. One open
// issue per drifted brand set, until someone resolves it.
report.fingerprint = report.drifted.length ? `ds-drift:${report.drifted.map((d) => d.brand).sort().join(',')}` : null;
report.shouldOpenIssue = report.drifted.length > 0 || report.broken.length > 0;

if (report.shouldOpenIssue) {
  const brands = report.drifted.map((d) => d.brand);
  report.issueTitle = report.drifted.length
    ? `Design-sync drift: ${brands.join(', ')} rethemed in-app since our last push`
    : `Design-sync drift scan is broken (${report.broken.map((b) => b.brand).join(', ')})`;
  report.issueBody = [
    report.drifted.length
      ? `The scheduled design-sync drift scan (GOL-411) found published token values that no longer match the baseline we last pushed for: **${brands.join(', ')}**.`
      : 'The scheduled design-sync drift scan could not form an opinion — treat its silence as uninformative, not as "no drift".',
    '',
    report.drifted.length
      ? 'That means a human almost certainly rethemed the brand in the Claude Design app. **This is a brand conversation before it is a code change** — ask the brand owner (Abigail / CMO-Sora) whether the values are intentional before touching anything. There is no version history on the published side, so a wrong guess here is unrecoverable.'
      : '',
    '',
    ...report.drifted.map((d) => [`### ${d.brand}`, '', '```', d.detail, '```', ''].join('\n')),
    ...report.broken.map((b) => [`### ${b.brand} (scan error, exit ${b.status})`, '', '```', b.detail, '```', ''].join('\n')),
    report.uncovered.length ? `**Not covered by this scan:** ${report.uncovered.map((u) => `\`${u.brand}\` (${u.why})`).join(', ')}. Drift in these brands would not be detected.` : '',
    report.notFetched.length ? `**Not fetched this run:** ${report.notFetched.map((u) => `\`${u.brand}\` (${u.why})`).join(', ')}. These were not checked.` : '',
  ].filter(Boolean).join('\n');
}

report.scannedAt = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));
