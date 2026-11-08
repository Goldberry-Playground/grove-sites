#!/usr/bin/env node
// GroveKit token lint — the TOKEN-MAP.md "Rules" section, enforced.
//
// packages/grove-tokens/TOKEN-MAP.md has said for months: "Never leave a raw hex
// or a --<bespoke> token in a lifted component's CSS — every value comes through
// a --grove-* role." Nothing checked it. The cost showed up in CaptureForm.css,
// which referenced --grove-color-foreground / -background / -danger — tokens
// that were never defined in contract.css — with hex fallbacks. The fallbacks
// made it render, so nobody noticed the component ignored every brand theme.
//
// This gate makes the three failure modes red:
//
//   raw-color   A color literal in a declaration value: #hex, rgb()/rgba(),
//               hsl()/hsla(). Colors come from --grove-color-* roles only.
//   foreign-var var(--x) where --x is not a --grove-* role AND is not a
//               component-local custom property declared in the same component
//               folder (CSS `--x:` or a TSX `"--x"` style key — the VendorCard /
//               ProductCard accent-prop pattern TOKEN-MAP explicitly allows).
//   phantom     var(--grove-x) where --grove-x is not defined in
//               packages/grove-tokens/src/contract.css. A fallback value does
//               not excuse it — the fallback is exactly what hides the bug.
//
// Escape hatch: append `/* grove-lint: allow */` to the offending line. Use it
// for a genuinely non-themeable value and say why in the comment.
//
// What is IN scope: packages/grove-ui/src/**/*.css (component stylesheets).
// What is OUT: contract.css itself (it *defines* the hexes), the brand themes
// (they assign them), app globals.css, generated ds-theme.*.css. Same boundary
// css-component-budget.mjs draws, for the same reason.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//   node scripts/grove-token-lint.mjs           # check (CI)
//   node scripts/grove-token-lint.mjs --json    # machine-readable
//
// Exit codes: 0 = clean · 1 = violation(s) · 2 = the check could not run
// (contract missing / no stylesheets matched). A broken check is red, never a
// silent green.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// GROVE_LINT_ROOT lets the test suite point the gate at a fixture tree.
const ROOT = process.env.GROVE_LINT_ROOT
  ? resolve(process.env.GROVE_LINT_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");

const CONTRACT = "packages/grove-tokens/src/contract.css";
const SCOPE_DIR = "packages/grove-ui/src";
const ALLOW_MARKER = "grove-lint: allow";

const argv = process.argv.slice(2);
const jsonOnly = argv.includes("--json");

const rel = (abs) => relative(ROOT, abs).split(sep).join("/");

function walk(absDir, keep, out = []) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    if (entry.isDirectory()) walk(abs, keep, out);
    else if (entry.isFile() && keep(entry.name)) out.push(abs);
  }
  return out;
}

// ── Preconditions ──────────────────────────────────────────────────────────
const contractAbs = join(ROOT, CONTRACT);
if (!existsSync(contractAbs)) {
  console.error(`::error::grove-token-lint: token contract not found at ${CONTRACT}`);
  process.exit(2);
}
const scopeAbs = join(ROOT, SCOPE_DIR);
if (!existsSync(scopeAbs) || !statSync(scopeAbs).isDirectory()) {
  console.error(`::error::grove-token-lint: scope directory ${SCOPE_DIR} not found`);
  process.exit(2);
}
const cssFiles = walk(scopeAbs, (n) => n.endsWith(".css")).sort();
if (cssFiles.length === 0) {
  console.error(`::error::grove-token-lint: no stylesheets under ${SCOPE_DIR}`);
  process.exit(2);
}

// ── The contract: every --grove-* role that exists ─────────────────────────
const DECL_RE = /(--[\w-]+)\s*:/g;
const defined = new Set();
for (const m of stripComments(readFileSync(contractAbs, "utf8")).matchAll(DECL_RE)) {
  defined.add(m[1]);
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Blank out comment bodies but keep every newline so line numbers survive.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

// Custom properties a component folder declares for itself: CSS `--x:` plus
// TSX/TS `"--x"` style keys (the accent-prop pattern). Cached per folder.
const localDeclCache = new Map();
function localDeclarations(folderAbs) {
  if (localDeclCache.has(folderAbs)) return localDeclCache.get(folderAbs);
  const set = new Set();
  const files = walk(folderAbs, (n) => /\.(css|tsx|ts)$/.test(n));
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (f.endsWith(".css")) {
      for (const m of stripComments(src).matchAll(DECL_RE)) set.add(m[1]);
    } else {
      for (const m of src.matchAll(/["'](--[\w-]+)["']\s*[:?]/g)) set.add(m[1]);
    }
  }
  localDeclCache.set(folderAbs, set);
  return set;
}

const COLOR_LITERAL_RE = /(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\()/g;
const VAR_RE = /var\(\s*(--[\w-]+)/g;
// Every `prop: value` segment on a line — a declaration starts the line or
// follows a `{` or `;`, so one-line rules (`.x { color: #fff; }`) are covered
// and selectors (`#id {`) are never read as values.
const DECLARATION_RE = /(?:^|[{;])\s*[a-zA-Z-]+\s*:([^;}]*)/g;

// ── Lint ───────────────────────────────────────────────────────────────────
const violations = [];

for (const fileAbs of cssFiles) {
  const file = rel(fileAbs);
  const raw = readFileSync(fileAbs, "utf8");
  const rawLines = raw.split("\n");
  const lines = stripComments(raw).split("\n");
  const local = localDeclarations(dirname(fileAbs));

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (rawLines[i].includes(ALLOW_MARKER)) return;

    // Rule: raw color literals, in declaration VALUES only (so an `#id`
    // selector or a url(#fragment) is never mistaken for a color).
    for (const decl of line.matchAll(DECLARATION_RE)) {
      const value = decl[1].replace(/url\([^)]*\)/g, "url()");
      for (const m of value.matchAll(COLOR_LITERAL_RE)) {
        violations.push({
          file,
          line: lineNo,
          rule: "raw-color",
          token: m[1].replace(/\($/, "()"),
          message: `raw color literal ${m[1].replace(/\($/, "()")} — use a --grove-color-* role (see TOKEN-MAP.md)`,
        });
      }
    }

    // Rules: foreign / phantom custom properties.
    for (const m of line.matchAll(VAR_RE)) {
      const name = m[1];
      if (name.startsWith("--grove-")) {
        if (!defined.has(name)) {
          violations.push({
            file,
            line: lineNo,
            rule: "phantom",
            token: name,
            message: `${name} is not defined in ${CONTRACT} — a fallback does not excuse it; pick an existing role`,
          });
        }
      } else if (!local.has(name)) {
        violations.push({
          file,
          line: lineNo,
          rule: "foreign-var",
          token: name,
          message: `${name} is not a --grove-* role and is not declared in this component — map it via TOKEN-MAP.md`,
        });
      }
    }
  });
}

// ── Report ─────────────────────────────────────────────────────────────────
const hasError = violations.length > 0;

if (jsonOnly) {
  console.log(
    JSON.stringify(
      {
        scope: SCOPE_DIR,
        contract: CONTRACT,
        filesChecked: cssFiles.length,
        definedTokens: defined.size,
        violations,
        hasError,
      },
      null,
      2,
    ),
  );
} else {
  console.error(
    `\nGroveKit token lint  ·  ${cssFiles.length} stylesheet(s) under ${SCOPE_DIR}  ·  ${defined.size} roles in contract\n`,
  );
  for (const v of violations) {
    console.error(`  [${v.rule.padEnd(11)}] ${v.file}:${v.line}  ${v.token}`);
    console.error(
      `::error title=GroveKit token lint,file=${v.file},line=${v.line}::${v.message}`,
    );
  }
  if (!hasError) console.error("All component stylesheets use --grove-* roles only. ✓");
  else console.error(`\n${violations.length} violation(s). Fix them or annotate with /* ${ALLOW_MARKER} */ and a reason.`);
}

process.exit(hasError ? 1 : 0);
