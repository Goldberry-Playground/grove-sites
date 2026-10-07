#!/usr/bin/env node
// Policy test for the `Dependency audit` gate's suppression file (GOL-3062).
// Run: `node scripts/ci/trivyignore-policy.test.mjs`
//
// WHY THIS EXISTS: on 2026-10-05 a braces@3.0.3 advisory published mid-afternoon
// and turned `Dependency audit` red on EVERY open grove-sites PR. auto-approve
// requires the whole `CI` run green before it merges, so one unfixable
// transitive dev-dependency CVE wedged the repo's entire agent merge path at
// once. The gate comment in ci.yml authorises exactly one escape hatch -- "a
// documented .trivyignore entry with an expiry" -- and explicitly forbids the
// tempting ones (raise severity, flip exit-code to 0).
//
// An escape hatch with no enforcement is how a gate dies quietly, and this one
// has two specific ways to rot silently. Both were measured on trivy 0.70.0,
// the version pinned by trivy-action@v0.36.0, scanning this repo's real
// pnpm-lock.yaml:
//
//   .trivyignore.yaml, auto-detected            -> exit 1   NOT suppressed
//   .trivyignore.yaml, explicit --ignorefile    -> exit 0   suppressed
//   .trivyignore, `exp:` in the future          -> exit 0   suppressed
//   .trivyignore, `exp:` in the past            -> exit 1   lapsed, by design
//   .trivyignore, malformed `exp:garbage`       -> exit 1   fails closed
//   .trivyignore, ID commented out              -> exit 1   sanity check
//
// Rot #1: `.trivyignore.yaml` is a valid Trivy format but `--ignorefile`
// defaults to `.trivyignore` ONLY, so that filename suppresses nothing while
// looking entirely handled. ci.yml passes no `trivyignores` input, so the
// filename is load-bearing. Banned outright here.
//
// Rot #2: a suppression with no `exp:` never gets revisited, and one with a
// malformed `exp:` silently applies to nothing. Trivy fails closed on both, so
// CI stays red either way -- but it stays red with a CVE table that says
// nothing about the real mistake. This test fails first, with the fix named.
//
// Node builtins only (`scripts/` is not a workspace, there is no yaml package).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Rot #1: one ignore surface, and it must be the auto-detected one ─────────
assert.equal(
  existsSync(join(repoRoot, '.trivyignore.yaml')),
  false,
  '`.trivyignore.yaml` is banned: Trivy\'s --ignorefile defaults to ' +
    '`.trivyignore` only, and ci.yml passes no `trivyignores` input, so that ' +
    'filename suppresses NOTHING while looking handled. Measured on trivy ' +
    '0.70.0. Move the entries into `.trivyignore`, one `<ID> exp:YYYY-MM-DD` ' +
    'per line.',
);

const path = join(repoRoot, '.trivyignore');

// No suppressions at all is the healthy state, and the state we want back.
if (!existsSync(path)) {
  console.log('trivyignore-policy: no .trivyignore — nothing suppressed, all assertions passed');
  process.exit(0);
}

const lines = readFileSync(path, 'utf8').split('\n');
const today = new Date(new Date().toISOString().slice(0, 10));
const WARN_DAYS = 10;
const MIN_STATEMENT = 80;

const checked = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line.startsWith('#')) continue;

  // ── Shape: the `exp:` is mandatory and must be a plain ISO date ───────────
  // Trivy's own parser is strict here and fails closed, so a wrong shape is a
  // suppression that applies to nothing. Catch it by name instead.
  const m = line.match(/^(\S+)\s+exp:(\S+)$/);
  assert.ok(
    m,
    `.trivyignore:${i + 1}: \`${line}\` is not \`<ID> exp:YYYY-MM-DD\`. The ` +
      `\`exp:\` is mandatory — an undated suppression is a permanently ` +
      `disabled gate, and Trivy ignores a malformed one entirely.`,
  );
  const [, id, exp] = m;
  assert.match(
    exp,
    /^\d{4}-\d{2}-\d{2}$/,
    `.trivyignore:${i + 1}: \`exp:${exp}\` on ${id} is not a plain ` +
      `YYYY-MM-DD date. Trivy will not parse it and will suppress nothing.`,
  );
  const when = new Date(exp);
  assert.ok(!Number.isNaN(when.getTime()), `.trivyignore:${i + 1}: \`exp:${exp}\` is not a real date.`);

  // ── Expiry: lapse is the forcing function, but it fails HERE first ────────
  const daysLeft = Math.round((when - today) / 86400000);
  assert.ok(
    daysLeft > 0,
    `.trivyignore:${i + 1}: the ${id} suppression EXPIRED on ${exp}, so Trivy ` +
      `has stopped honouring it and \`Dependency audit\` is red again by ` +
      `design. Re-decide now: upgrade out of it if a fixed version exists ` +
      `(preferred), or extend \`exp:\` with a refreshed \`statement:\` saying ` +
      `why it is still unreachable. Do NOT raise \`severity\` or flip ` +
      `\`exit-code\` in ci.yml.`,
  );

  // ── Rationale: the comment block directly above carries the argument ──────
  const block = [];
  for (let j = i - 1; j >= 0 && lines[j].trim().startsWith('#'); j--) block.unshift(lines[j].trim());
  const statementAt = block.findIndex((l) => /^#\s*statement:/i.test(l));
  assert.notEqual(
    statementAt,
    -1,
    `.trivyignore:${i + 1}: no \`# statement:\` in the comment block directly ` +
      `above ${id}. Record WHY the vulnerable code is unreachable for us — the ` +
      `dependency path, and why no untrusted input reaches it — not that the ` +
      `finding is inconvenient.`,
  );
  const statement = block
    .slice(statementAt)
    .join(' ')
    .replace(/^#\s*statement:/i, '')
    .replace(/#/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  assert.ok(
    statement.length >= MIN_STATEMENT,
    `.trivyignore:${i + 1}: the \`statement:\` for ${id} is ${statement.length} ` +
      `chars; at least ${MIN_STATEMENT} are needed to actually make an ` +
      `unreachability argument.`,
  );

  if (daysLeft <= WARN_DAYS) {
    console.log(
      `::warning file=.trivyignore,line=${i + 1}::${id} suppression expires in ` +
        `${daysLeft} day(s) (${exp}). Check for a fixed version before it reddens CI repo-wide.`,
    );
  }
  checked.push(`${id} -> ${exp}`);
}

assert.ok(
  checked.length > 0,
  '.trivyignore exists but suppresses nothing (all lines blank or commented). ' +
    'Delete the file instead of leaving an empty suppression list behind.',
);

console.log(`trivyignore-policy: ${checked.length} suppression(s) checked (${checked.join(', ')}); all assertions passed`);
