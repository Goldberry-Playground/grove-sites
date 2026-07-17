#!/usr/bin/env node
// Pre-push guard: refuse to clobber an in-app retheme (GOL-402).
//
// `.design-sync` is one-way outbound with no version history on the far side.
// Nothing stopped an outbound push from silently overwriting a change a brand
// owner made in the Claude Design app — and because the push makes repo and
// published agree again (by clobber), no drift detector would ever fire. The
// brand owner's work would just be gone, and the first person to notice would
// be the brand owner, months later.
//
// This script is the guard. It compares the PUBLISHED token values against a
// committed BASELINE of what we last pushed, and aborts the build if a human
// has touched the project since.
//
// ── Why baseline-vs-published, and not repo-vs-published ──────────────────
//
// The obvious guard — "abort if published != repo" — is unusable: you only run
// a push BECAUSE the repo changed, so repo != published is the normal, correct
// state on every legitimate push. That guard fires every single time, teaches
// everyone to pass --force reflexively, and protects nothing.
//
// The question that actually matters is narrower: *did someone change the
// published project since we last pushed it?* That needs a third point of
// reference — the baseline — recording the token values as of our last push:
//
//   published == baseline   → nobody touched it in-app. Our repo-vs-published
//                             delta is our own intended change. Safe to push.
//   published != baseline   → a human changed it in the app. ABORT. Overwriting
//                             would destroy their work. Needs an explicit call.
//
// So this fires only on real in-app edits — which is what makes --force mean
// something when it does fire.
//
// ── Why tokens and not bytes ──────────────────────────────────────────────
//
// The converter rewrites the CSS on its way out (e.g. an @font-face whose src
// can't be resolved becomes `/* @ds-font-face-dropped: unresolvable src */`),
// so published _ds_bundle.css is never byte-identical to its repo source even
// when nothing has drifted. Custom-property VALUES survive that rewrite intact,
// and they are also the thing a retheme actually changes. So we diff those.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//
//   node scripts/ds-guard.mjs --brand goldberry --published <fetched.css>
//   node scripts/ds-guard.mjs --brand goldberry --published <fetched.css> --adopt
//
// The fetch itself is the agent's job — DesignSync (get_file) is the only thing
// holding auth for the project, and it has no CLI. ds-build.sh tells you the
// exact call to make. This script is the deterministic half: no network, so CI
// and a local run can never disagree about what "diverged" means. This mirrors
// how .ds-sync/lib/remote-diff.mjs already splits agent-fetch from local-diff.
//
// Exit codes: 0 = safe to push · 1 = DIVERGED, do not push · 2 = usage error.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS = ['goldberry', 'ggg', 'nursery', 'hub'];

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i < 0 ? null : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const brand = flag('brand');
const publishedPath = flag('published');
const adopt = has('adopt');

if (!brand || !BRANDS.includes(brand)) {
  console.error(`usage: ds-guard.mjs --brand <${BRANDS.join('|')}> --published <file.css> [--adopt]`);
  process.exit(2);
}
if (!publishedPath) {
  console.error('usage: ds-guard.mjs --brand <brand> --published <file.css> [--adopt]');
  process.exit(2);
}

const baselinePath = join(ROOT, '.design-sync', `baseline.${brand}.json`);
const repoCssPath = join(ROOT, 'packages/grove-ui', `ds-theme.${brand}.css`);
const configPath = join(ROOT, '.design-sync', `config.${brand}.json`);

// ── Token extraction ──────────────────────────────────────────────────────
//
// Pull every CSS custom-property declaration and the selector it sits under.
// Keying on `selector\0--prop` (not the bare prop name) keeps a token defined
// under both :root and a media/dark block from collapsing into one entry and
// silently hiding a divergence in whichever copy lost the race.
//
// Hand-rolled rather than a PostCSS dependency: this runs in ds-build.sh's
// preflight and in CI on a bare checkout, and must not need an install. It
// tracks strings/comments/parens/braces, which is all the CSS we generate uses.
function extractTokens(css) {
  const tokens = new Map();
  const stack = [];
  let i = 0;
  let buf = '';

  // Selectors are collapsed to single-line form: the generated CSS wraps
  // `:root,\n[data-grove-theme="goldberry"]` across lines, and keeping the
  // newline both mangles the printed diff and would make a pure reflow of the
  // selector read as a different token.
  const flush = () => { const s = buf.trim().replace(/\s+/g, ' '); buf = ''; return s; };
  const selector = () => stack.filter(Boolean).join(' ');

  while (i < css.length) {
    const c = css[i];

    // Comments — never contain declarations we care about. Dropping them here
    // also means a comment-only edit can't read as a token change.
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    // Strings — a ';' or '{' inside one is data, not syntax.
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < css.length && css[j] !== q) j += css[j] === '\\' ? 2 : 1;
      buf += css.slice(i, Math.min(j + 1, css.length));
      i = j + 1;
      continue;
    }
    // Parens — url(...) and nested var(--x, fallback) can hold ';' and ','.
    if (c === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '(') depth++;
        else if (css[j] === ')') depth--;
        else if (css[j] === '"' || css[j] === "'") {
          const q = css[j];
          j++;
          while (j < css.length && css[j] !== q) j += css[j] === '\\' ? 2 : 1;
        }
        j++;
      }
      buf += css.slice(i, j);
      i = j;
      continue;
    }
    if (c === '{') { stack.push(flush()); i++; continue; }
    if (c === '}') { flush(); stack.pop(); i++; continue; }
    if (c === ';') {
      const decl = flush();
      const eq = decl.indexOf(':');
      if (eq > 0) {
        const prop = decl.slice(0, eq).trim();
        // Custom properties only. Regular declarations are component styling,
        // not brand-owner surface, and they churn on every component lift —
        // keeping them out is what keeps this guard quiet enough to trust.
        if (prop.startsWith('--')) {
          // Normalize away differences that are not changes of intent:
          //  - internal whitespace (the converter reindents)
          //  - hex case — our pipeline emits the repo's lowercase, the in-app
          //    editor re-emits uppercase. #3A2418 and #3a2418 are the same
          //    colour; treating them as divergence would fire the guard on
          //    every ggg/nursery push forever and train everyone to --force,
          //    which is precisely the failure this guard exists to avoid.
          //    Only hex literals are folded, so a font name or a keyword
          //    keeps its case.
          const value = decl.slice(eq + 1).trim()
            .replace(/\s+/g, ' ')
            .replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => m.toLowerCase());
          tokens.set(`${selector()}\0${prop}`, value);
        }
      }
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  return tokens;
}

const readOr = (p, what) => {
  try { return readFileSync(p, 'utf8'); }
  catch (e) { console.error(`✗ ${what} unreadable at ${p} (${e.message})`); process.exit(2); }
};

const publishedCss = readOr(publishedPath, 'published bundle');
const publishedTokens = extractTokens(publishedCss);
const publishedSha = createHash('sha256').update(publishedCss).digest('hex');

if (publishedTokens.size === 0) {
  // An empty parse would otherwise read as "matches an empty baseline" — i.e.
  // a truncated or wrong-path fetch would wave the push through. Never allow
  // absence of evidence to become evidence of safety.
  console.error(`✗ no CSS custom properties found in ${publishedPath}`);
  console.error('  That file is not a published _ds_bundle.css — refusing to vouch for it.');
  process.exit(2);
}

const projectId = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')).projectId : null;

// ── --adopt: record the live published state as the new baseline ───────────
if (adopt) {
  // Adopting says "the guard should stop objecting to this published state".
  // That is exactly the move that ARMS a clobber: once the baseline matches
  // published, the guard waves the next push through, and that push overwrites
  // every token where published and repo disagree. If one of those values is
  // something a human meant, adopting is what destroys it — quietly, one step
  // removed from the damage, which is the worst way to lose it.
  //
  // The script can't know intent, so it doesn't refuse (a refusal here would
  // just get --force'd). It shows the bill instead: these are the values the
  // next push will overwrite. Read them before you commit the baseline.
  const repoTokens = extractTokens(readOr(repoCssPath, 'repo theme artifact'));
  const willOverwrite = [];
  for (const [key, pubValue] of publishedTokens) {
    if (repoTokens.has(key) && repoTokens.get(key) !== pubValue) willOverwrite.push([key, pubValue, repoTokens.get(key)]);
  }
  if (willOverwrite.length) {
    console.error('');
    console.error(`  ! Adopting ${brand} arms the next push to OVERWRITE ${willOverwrite.length} published token value(s):`);
    console.error('');
    for (const [k, pub, repo] of willOverwrite.slice(0, 25)) {
      const [sel, prop] = k.split('\0');
      console.error(`     ${prop}${sel && sel !== ':root' ? `  (in ${sel})` : ''}`);
      console.error(`         published (will be lost): ${pub}`);
      console.error(`         repo      (will win):     ${repo}`);
    }
    if (willOverwrite.length > 25) console.error(`     … and ${willOverwrite.length - 25} more`);
    console.error('');
    console.error('     If any of those published values is a brand owner\'s deliberate choice, STOP.');
    console.error(`     Port it into packages/grove-tokens/src/themes/${brand}.css first, regenerate`);
    console.error('     (./scripts/ds-theme-gen.sh --all), and adopt after that — then the push');
    console.error('     preserves it instead of erasing it.');
    console.error('');
  }
  const baseline = {
    _comment: [
      'GOL-402 pre-push guard baseline: the token values PUBLISHED in this brand\'s',
      'Claude Design project as of our last outbound push. ds-guard.mjs compares the',
      'live published bundle against this; a mismatch means a human retheme happened',
      'in-app and an outbound push would destroy it. Regenerate ONLY via',
      '`ds-build.sh <brand> --adopt-baseline` immediately after a push you made, or',
      'after you have consciously accepted an in-app change. Never hand-edit.',
    ].join(' '),
    brand,
    projectId,
    adoptedAt: new Date().toISOString(),
    publishedSha256: publishedSha,
    tokenCount: publishedTokens.size,
    // Sorted: a stable key order keeps the git diff of this file readable, so a
    // reviewer can see exactly which token moved.
    tokens: Object.fromEntries([...publishedTokens].sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`✓ baseline adopted for ${brand}: ${publishedTokens.size} tokens → .design-sync/baseline.${brand}.json`);
  console.log('  Commit this. It is the anchor the guard compares future pushes against.');
  process.exit(0);
}

// ── Pick the comparison anchor ────────────────────────────────────────────
let anchorTokens;
let anchorLabel;
let anchorIsBaseline;

if (existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  if (projectId && baseline.projectId && baseline.projectId !== projectId) {
    // Guarding brand A's push with brand B's baseline would be worse than no
    // guard: it would report confident nonsense.
    console.error(`✗ baseline.${brand}.json is for project ${baseline.projectId}, but config.${brand}.json targets ${projectId}`);
    console.error('  Refusing to compare across projects. Re-adopt the baseline.');
    process.exit(2);
  }
  anchorTokens = new Map(Object.entries(baseline.tokens ?? {}));
  anchorLabel = `baseline (our last push, adopted ${baseline.adoptedAt ?? 'unknown'})`;
  anchorIsBaseline = true;
} else {
  // No baseline yet. Fall back to the repo artifact and be conservative: we
  // have no record of what we last pushed, so we cannot tell "they changed it"
  // from "we did". Any divergence stops the push and asks for a human call.
  anchorTokens = extractTokens(readOr(repoCssPath, 'repo theme artifact'));
  anchorLabel = `repo artifact packages/grove-ui/ds-theme.${brand}.css (no baseline yet — conservative fallback)`;
  anchorIsBaseline = false;
}

// ── Diff ──────────────────────────────────────────────────────────────────
const changed = [];
const removed = []; // in anchor, gone from published
const added = [];   // in published, not in anchor

for (const [key, anchorValue] of anchorTokens) {
  if (!publishedTokens.has(key)) { removed.push([key, anchorValue]); continue; }
  const pubValue = publishedTokens.get(key);
  if (pubValue !== anchorValue) changed.push([key, anchorValue, pubValue]);
}
for (const [key, pubValue] of publishedTokens) {
  if (!anchorTokens.has(key)) added.push([key, pubValue]);
}

const total = changed.length + removed.length + added.length;
const pretty = (key) => {
  const [sel, prop] = key.split('\0');
  return sel && sel !== ':root' ? `${prop}  (in ${sel})` : prop;
};

if (total === 0) {
  console.log(`✓ ds-guard [${brand}]: published matches ${anchorLabel}`);
  console.log(`  ${publishedTokens.size} tokens compared, 0 divergent — nobody has rethemed in-app. Safe to push.`);
  process.exit(0);
}

console.error('');
console.error(`✗ ds-guard [${brand}]: PUBLISHED PROJECT HAS DIVERGED — refusing to push.`);
console.error('');
console.error(`  anchor:    ${anchorLabel}`);
console.error(`  published: ${publishedPath}`);
console.error(`             sha256 ${publishedSha.slice(0, 16)}…, ${publishedTokens.size} tokens`);
console.error('');
if (anchorIsBaseline) {
  console.error(`  ${total} token(s) changed in the published project since our last push.`);
  console.error('  Someone almost certainly rethemed in the Claude Design app. Pushing now would');
  console.error('  overwrite their work, and there is no version history on that side to restore from.');
} else {
  console.error(`  ${total} token(s) differ between the published project and the repo, and there is no`);
  console.error('  baseline recording what we last pushed — so this cannot tell an in-app retheme');
  console.error('  from our own un-pushed repo changes. Resolve it explicitly (see below).');
}
console.error('');

const show = (label, rows, fmt) => {
  if (!rows.length) return;
  console.error(`  ── ${label} (${rows.length}) ──`);
  for (const r of rows.slice(0, 40)) console.error(`     ${fmt(r)}`);
  if (rows.length > 40) console.error(`     … and ${rows.length - 40} more`);
  console.error('');
};
show('CHANGED VALUE', changed, ([k, a, p]) => `${pretty(k)}\n         anchor:    ${a}\n         published: ${p}`);
show('ONLY IN PUBLISHED (added in-app)', added, ([k, p]) => `${pretty(k)} = ${p}`);
show('MISSING FROM PUBLISHED (removed in-app, or never pushed)', removed, ([k, a]) => `${pretty(k)} = ${a}`);

console.error('  ── What to do ──');
if (anchorIsBaseline) {
  console.error('     This is a brand conversation before it is a code change. Ask the brand owner');
  console.error('     (Abigail / CMO-Sora) whether those values are intentional.');
  console.error('');
  console.error('     • KEEP their change  → port the values into');
  console.error(`                            packages/grove-tokens/src/themes/${brand}.css, regenerate`);
  console.error('                            (./scripts/ds-theme-gen.sh --all), then re-adopt:');
  console.error(`                            ./scripts/ds-build.sh ${brand} --adopt-baseline`);
  console.error('     • DISCARD their change → they have signed off on losing it. Re-push with:');
  console.error(`                            ./scripts/ds-build.sh ${brand} --force`);
} else {
  console.error('     • If the published values are ours (stale push, nobody rethemed), adopt the');
  console.error('       current published state as the baseline, then push normally:');
  console.error(`         ./scripts/ds-build.sh ${brand} --adopt-baseline`);
  console.error('     • If you are not sure, ASK before pushing. A wrong guess here is unrecoverable.');
}
console.error('');
process.exit(1);
