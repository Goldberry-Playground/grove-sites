#!/usr/bin/env node
// GroveKit theme contrast gate — WCAG contrast for every brand's token pairs.
//
// contract.css documents ratios in comments ("4.91:1 on paper") and TOKEN-MAP
// promises the status roles clear 4.5:1. Nothing recomputed them when a brand
// theme reassigned --grove-color-ink or --grove-color-paper. This gate resolves
// each brand's FINAL value per role (theme overrides the contract default,
// var() aliases followed) and checks the pairs in grove-theme-contrast.config.json
// with the WCAG 2.x relative-luminance formula.
//
//   contrast     a pair is under its floor (4.5:1 text, 3:1 fills)   → error
//   unknown-role a theme sets a --grove-* name contract.css never
//                defines (the typo guard)                            → error
//   unparseable  a role in a checked pair is not a hex/rgb color     → error
//   unchecked    a role built with color-mix() — reported, not failed
//   AAA          body ink under 7:1 — warning only
//
// Ratchet: pairs that already failed when the gate landed can be recorded in
// config.baseline at their ratio. They may only improve, never regress.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//   node scripts/grove-theme-contrast.mjs            # check (CI)
//   node scripts/grove-theme-contrast.mjs --json     # machine-readable
//   node scripts/grove-theme-contrast.mjs --update-baseline
//
// Exit codes: 0 = clean (warnings allowed) · 1 = violation(s) · 2 = could not
// run (contract/themes/config missing). A broken check is red, never a silent
// green.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
// GROVE_LINT_ROOT lets the test suite point the gate at a fixture tree. The
// fixture may carry its own config; otherwise the repo's config applies.
const ROOT = process.env.GROVE_LINT_ROOT ? resolve(process.env.GROVE_LINT_ROOT) : REPO;
const CONFIG_PATH = existsSync(join(ROOT, "grove-theme-contrast.config.json"))
  ? join(ROOT, "grove-theme-contrast.config.json")
  : join(REPO, "grove-theme-contrast.config.json");

const argv = process.argv.slice(2);
const jsonOnly = argv.includes("--json");
const updateBaseline = argv.includes("--update-baseline");

function die(msg) {
  console.error(`::error::grove-theme-contrast: ${msg}`);
  process.exit(2);
}

if (!existsSync(CONFIG_PATH)) die("grove-theme-contrast.config.json not found");
const CONFIG = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const contractRel = CONFIG.contract;
const themesRel = CONFIG.themesDir;
const contractAbs = join(ROOT, contractRel);
const themesAbs = join(ROOT, themesRel);
if (!existsSync(contractAbs)) die(`token contract not found at ${contractRel}`);
if (!existsSync(themesAbs)) die(`themes directory not found at ${themesRel}`);
const themeFiles = readdirSync(themesAbs).filter((f) => f.endsWith(".css")).sort();
if (themeFiles.length === 0) die(`no brand themes under ${themesRel}`);

// ── CSS parsing ────────────────────────────────────────────────────────────
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "");
function declarations(src) {
  // `--name: value;` — value runs to the next `;` (color-mix() has no `;`).
  const out = new Map();
  for (const m of stripComments(src).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}
const contract = declarations(readFileSync(contractAbs, "utf8"));

// ── Color math (WCAG 2.x) ──────────────────────────────────────────────────
function parseColor(value) {
  const v = value.trim().toLowerCase();
  let m;
  if ((m = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/))) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  if ((m = v.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/))) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}
function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
const fmt = (x) => `${x.toFixed(2)}:1`;

// ── Resolve a brand's final value for a role ───────────────────────────────
// Returns { kind: "color", color } | { kind: "unchecked", reason } |
// { kind: "unparseable", value } | { kind: "missing" }.
function resolveRole(theme, role) {
  const seen = new Set();
  let name = role;
  for (let depth = 0; depth < 12; depth++) {
    if (seen.has(name)) return { kind: "unparseable", value: `alias cycle via ${name}` };
    seen.add(name);
    const raw = theme.has(name) ? theme.get(name) : contract.get(name);
    if (raw == null) return { kind: "missing", role: name };
    if (/color-mix\(/i.test(raw)) return { kind: "unchecked", reason: "color-mix()" };
    const alias = raw.match(/^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/);
    if (alias) {
      name = alias[1];
      continue;
    }
    const color = parseColor(raw);
    if (!color) return { kind: "unparseable", value: raw };
    if (color.a < 1) return { kind: "unchecked", reason: `alpha ${color.a}` };
    return { kind: "color", color, raw, via: name === role ? null : name };
  }
  return { kind: "unparseable", value: "alias chain too deep" };
}

// ── Run ────────────────────────────────────────────────────────────────────
const baseline = CONFIG.baseline && typeof CONFIG.baseline === "object" ? CONFIG.baseline : {};
const pairGroups = Object.entries(CONFIG.pairs).filter(([k]) => !k.startsWith("$"));

const brands = [];
const violations = []; // { brand, file, rule, message, key?, ratio? }
const warnings = [];
const freshBaseline = {};

for (const file of themeFiles) {
  const brand = basename(file, ".css");
  const rel = `${themesRel}/${file}`;
  const theme = declarations(readFileSync(join(themesAbs, file), "utf8"));
  const result = { brand, file: rel, pairs: [], unchecked: [], unknownRoles: [] };

  // Typo guard: every --grove-* the theme sets must exist in the contract.
  for (const name of theme.keys()) {
    if (name.startsWith("--grove-") && !contract.has(name)) {
      result.unknownRoles.push(name);
      violations.push({ brand, file: rel, rule: "unknown-role", message: `${name} is set by the ${brand} theme but ${contractRel} never defines it (typo?)` });
    }
  }

  for (const [group, spec] of pairGroups) {
    for (const fgRole of spec.fg) {
      for (const bgRole of spec.bg) {
        const key = `${brand} ${fgRole} on ${bgRole}`;
        const fg = resolveRole(theme, fgRole);
        const bg = resolveRole(theme, bgRole);
        const pair = { group, fg: fgRole, bg: bgRole, min: spec.min, warnBelow: spec.warnBelow ?? null };

        const bad = [fg, bg].find((r) => r.kind !== "color");
        if (bad) {
          if (bad.kind === "unchecked") {
            pair.status = "unchecked";
            pair.note = bad.reason;
            result.unchecked.push(`${fgRole} on ${bgRole} (${bad.reason})`);
          } else if (bad.kind === "missing") {
            pair.status = "error";
            pair.note = `${bad.role} is not defined`;
            violations.push({ brand, file: rel, rule: "missing-role", message: `${key}: ${bad.role} is not defined in the theme or the contract` });
          } else {
            pair.status = "error";
            pair.note = `unparseable: ${bad.value}`;
            violations.push({ brand, file: rel, rule: "unparseable", message: `${key}: cannot parse "${bad.value}" as a color` });
          }
          result.pairs.push(pair);
          continue;
        }

        const ratio = contrastRatio(fg.color, bg.color);
        pair.ratio = Math.round(ratio * 100) / 100;
        pair.fgValue = fg.raw + (fg.via ? ` (via ${fg.via})` : "");
        pair.bgValue = bg.raw + (bg.via ? ` (via ${bg.via})` : "");

        if (ratio < spec.min) {
          if (Object.prototype.hasOwnProperty.call(baseline, key)) {
            const recorded = baseline[key];
            if (ratio + 0.01 >= recorded) {
              pair.status = "debt";
              pair.note = `baseline ${fmt(recorded)}, may only improve`;
            } else {
              pair.status = "error";
              pair.note = `regressed below its baseline ${fmt(recorded)}`;
              violations.push({ brand, file: rel, rule: "contrast", key, ratio: pair.ratio, message: `${key}: ${fmt(ratio)} regressed below its recorded baseline ${fmt(recorded)} (floor ${fmt(spec.min)})` });
            }
          } else {
            pair.status = "error";
            violations.push({ brand, file: rel, rule: "contrast", key, ratio: pair.ratio, message: `${key}: ${fmt(ratio)} is under the ${fmt(spec.min)} floor (${fgRole} ${fg.raw} on ${bgRole} ${bg.raw})` });
          }
          freshBaseline[key] = pair.ratio;
        } else if (spec.warnBelow && ratio < spec.warnBelow) {
          pair.status = "warn";
          pair.note = `under ${fmt(spec.warnBelow)} AAA`;
          warnings.push({ brand, file: rel, message: `${key}: ${fmt(ratio)} clears AA but is under the ${fmt(spec.warnBelow)} AAA mark` });
        } else {
          pair.status = "ok";
        }
        result.pairs.push(pair);
      }
    }
  }
  brands.push(result);
}

// ── --update-baseline ──────────────────────────────────────────────────────
if (updateBaseline) {
  const fresh = {};
  if (baseline.$comment) fresh.$comment = baseline.$comment;
  Object.assign(fresh, freshBaseline);
  CONFIG.baseline = fresh;
  writeFileSync(CONFIG_PATH, JSON.stringify(CONFIG, null, 2) + "\n");
  console.error(`Updated baseline: ${Object.keys(freshBaseline).length} failing pair(s) recorded.`);
  process.exit(0);
}

// ── Report ─────────────────────────────────────────────────────────────────
const hasError = violations.length > 0;
if (jsonOnly) {
  console.log(JSON.stringify({ contract: contractRel, brands, violations, warnings, hasError, hasWarn: warnings.length > 0 }, null, 2));
} else {
  console.error(`\nGroveKit theme contrast  ·  ${brands.length} brand theme(s)  ·  ${pairGroups.length} pair group(s)\n`);
  for (const b of brands) {
    console.error(`  ${b.brand}`);
    for (const p of b.pairs) {
      const flag = p.status === "error" ? "ERROR" : p.status === "debt" ? "debt " : p.status === "warn" ? "warn " : p.status === "unchecked" ? "skip " : "ok   ";
      const ratio = p.ratio != null ? fmt(p.ratio).padStart(8) : "       —";
      console.error(`    [${flag}] ${ratio}  ${p.fg.replace("--grove-color-", "")} on ${p.bg.replace("--grove-color-", "")}  (≥ ${p.min})${p.note ? `  ${p.note}` : ""}`);
    }
  }
  for (const v of violations) console.error(`::error title=GroveKit theme contrast,file=${v.file}::${v.message}`);
  for (const w of warnings) console.error(`::warning title=GroveKit theme contrast,file=${w.file}::${w.message}`);
  console.error(hasError ? `\n${violations.length} violation(s).` : "\nEvery checked pair clears its WCAG floor. ✓");
}
process.exit(hasError ? 1 : 0);
