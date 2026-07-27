#!/usr/bin/env node
// Per-component CSS ceiling gate (GOL-866, spec GOL-864 §1c).
//
// This is the direct Angular `budgets` analog Josh asked for: Angular fails the
// build when a single component stylesheet exceeds a threshold (warn ~2 KB /
// error ~4-6 KB). We are Tailwind + per-component `.css` files, so we apply the
// same discipline to the bespoke stylesheets in @grove/ui/src — the place where
// one-off values and drift actually accumulate.
//
// What is IN scope: packages/grove-ui/src/**/*.css (component stylesheets).
// What is OUT (and why): app `globals.css` (app-wide, not a component),
// generated `ds-theme.<brand>.css` (concatenated artifact), and token
// `contract.css` (the token layer). Those are large by design and live outside
// src/, so the include glob already excludes them. Tailwind utility classes
// don't count against any component either — they're shared and purged.
//
// A component over budget almost always means a value that should be a token
// (§3) or a pattern that belongs in @grove/ui shared, not a one-off block.
//
// ── Ratchet baseline ───────────────────────────────────────────────────────
// Four stylesheets were already over the 6 KB ceiling when this gate landed
// (Checkout/Cart pages). Failing the PR that INTRODUCES the gate on pre-existing
// debt helps no one, so those files are grandfathered in
// perf-budget.config.json → componentCss.baseline at their current size: each
// may only SHRINK, never grow, and every other/new file gets the strict 6 KB
// ceiling. Refactoring them under budget is a tracked GOL-866 follow-up.
//   Regenerate the baseline after an intentional change:
//     node scripts/css-component-budget.mjs --update-baseline
//
// ── Usage ─────────────────────────────────────────────────────────────────
//   node scripts/css-component-budget.mjs             # check (CI)
//   node scripts/css-component-budget.mjs --json      # machine-readable
//   node scripts/css-component-budget.mjs --update-baseline
//
// Exit codes: 0 = within budget (warnings allowed) · 1 = a file exceeded its
// limit · 2 = the check could not run (config missing / no files matched).

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname, relative, sep, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Repo root by default; PERF_BUDGET_ROOT lets the test suite point the gate at a
// fixture tree without touching the real packages/ output.
const ROOT = process.env.PERF_BUDGET_ROOT
  ? resolve(process.env.PERF_BUDGET_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, "perf-budget.config.json");
const CONFIG = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const CC = CONFIG.componentCss;
const KB = 1024;
const fmt = (b) => `${(b / KB).toFixed(2)} KB`;

const argv = process.argv.slice(2);
const jsonOnly = argv.includes("--json");
const updateBaseline = argv.includes("--update-baseline");

// Minimal glob support for the patterns we actually use: a leading
// "<dir>/**/*.css" shape. Walk <dir> recursively, keep files ending in the
// suffix. Avoids pulling a glob dependency into a lockfile-gated repo.
function expandGlob(pattern) {
  const starIdx = pattern.indexOf("/**/");
  if (starIdx === -1) {
    const abs = join(ROOT, pattern);
    return existsSync(abs) && statSync(abs).isFile() ? [pattern] : [];
  }
  const base = pattern.slice(0, starIdx);
  const suffix = pattern.slice(starIdx + 4).replace(/^\*/, ""); // "*.css" → ".css"
  const baseAbs = join(ROOT, base);
  if (!existsSync(baseAbs)) return [];
  const out = [];
  const walk = (absDir) => {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const abs = join(absDir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith(suffix)) {
        out.push(relative(ROOT, abs).split(sep).join("/"));
      }
    }
  };
  walk(baseAbs);
  return out;
}

const excluded = new Set(CC.exclude || []);
const files = [...new Set((CC.include || []).flatMap(expandGlob))]
  .filter((f) => !excluded.has(f))
  .sort();

if (files.length === 0) {
  console.error(
    `::error::css-component-budget: no files matched ${JSON.stringify(
      CC.include,
    )} — check the include globs.`,
  );
  process.exit(2);
}

const baseline = CC.baseline && typeof CC.baseline === "object" ? CC.baseline : {};

const results = files.map((f) => {
  const bytes = statSync(join(ROOT, f)).size;
  // Grandfathered files keep their recorded size as the limit (shrink-only);
  // everything else gets the strict error ceiling.
  const grandfathered = Object.prototype.hasOwnProperty.call(baseline, f);
  const limit = grandfathered ? baseline[f] : CC.errorBytes;
  const error = bytes > limit;
  // Grandfathered files are already tracked debt — a per-PR "over soft budget"
  // warning on them is unactionable noise that just trains people to mute the
  // gate. They only speak up when they ERROR (i.e. grow past their baseline).
  const warn = !error && !grandfathered && bytes > CC.warnBytes;
  return { file: f, bytes, limit, grandfathered, error, warn };
});

// ── --update-baseline: rewrite the baseline map to current over-ceiling files ─
if (updateBaseline) {
  const fresh = {};
  const keptComment = baseline.$comment;
  if (keptComment) fresh.$comment = keptComment;
  for (const r of results) {
    if (r.bytes > CC.errorBytes) fresh[r.file] = r.bytes;
  }
  CONFIG.componentCss.baseline = fresh;
  writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2) + "\n");
  const n = Object.keys(fresh).filter((k) => k !== "$comment").length;
  console.error(`Updated baseline: ${n} file(s) over the ${fmt(CC.errorBytes)} ceiling recorded.`);
  process.exit(0);
}

let hasError = false;
let hasWarn = false;

if (!jsonOnly) {
  console.error(
    `\nPer-component CSS ceiling (uncompressed)  ·  warn ${fmt(CC.warnBytes)} / error ${fmt(
      CC.errorBytes,
    )}\n`,
  );
}

for (const r of results) {
  if (r.error) hasError = true;
  else if (r.warn) hasWarn = true;

  if (!jsonOnly) {
    const flag = r.error ? "ERROR" : r.grandfathered ? "debt " : r.warn ? "warn " : "ok   ";
    const note = r.grandfathered ? `  (baseline ${fmt(r.limit)}, shrink-only)` : "";
    console.error(`  [${flag}] ${fmt(r.bytes).padStart(9)}  ${r.file}${note}`);
  }

  if (r.error) {
    const reason = r.grandfathered
      ? `grew past its ratchet baseline of ${fmt(r.limit)} — a grandfathered file may only shrink`
      : `exceeds the ${fmt(CC.errorBytes)} component ceiling`;
    console.error(
      `::error title=CSS component budget::${r.file}: ${fmt(
        r.bytes,
      )} ${reason}. Extract shared patterns to @grove/ui or replace one-off values with tokens (GOL-864 §3).`,
    );
  } else if (r.warn) {
    console.error(
      `::warning title=CSS component budget::${r.file}: ${fmt(r.bytes)} is over the ${fmt(
        CC.warnBytes,
      )} soft budget — watch for creep toward the ${fmt(CC.errorBytes)} ceiling.`,
    );
  }
}

if (jsonOnly) {
  console.log(JSON.stringify({ warnBytes: CC.warnBytes, errorBytes: CC.errorBytes, results, hasError, hasWarn }, null, 2));
} else if (!hasError && !hasWarn) {
  console.error("All component stylesheets within budget. ✓");
}

process.exit(hasError ? 1 : 0);
