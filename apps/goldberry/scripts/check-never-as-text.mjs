#!/usr/bin/env node
/**
 * never-as-text guardrail (GOL-108)
 * --------------------------------------------------------------------------
 * Some brand tokens are light-on-light and can NEVER carry meaning as text or
 * icon foreground on a light (ivory/cream) surface — they fail WCAG 1.4.3
 * (4.5:1 body / 3:1 large) badly:
 *
 *   --harvest-gold      #EDD682   1.35:1 on ivory   (alias: --gold)
 *   --harvest-gold-deep #C9B25C   1.97:1 on ivory   (alias: --gold-deep)
 *   --midnight-bark     #CCA75C   2.13:1 on ivory
 *
 * They are fine as backgrounds, borders, dividers, and as text ON a dark
 * surface (e.g. gold text inside a Forest/Chestnut band). A stylesheet regex
 * can't see the background, so this guard is a DRIFT guard, not a contrast
 * checker: it snapshots every existing `color:`/`fill:` use of these tokens
 * into an allowlist baseline. Any NEW use of a never-as-text token as text/
 * icon foreground that isn't in the baseline fails the build, forcing a
 * conscious decision (and a note that the new site must be a dark surface).
 *
 * See apps/goldberry/BRAND-A11Y.md for the policy. Existing baseline entries
 * are the render-time audit backlog folded into GOL-106.
 *
 * Usage:
 *   node scripts/check-never-as-text.mjs           # check (exit 1 on drift)
 *   node scripts/check-never-as-text.mjs --update   # regenerate the baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..");
const CSS_ROOT = join(APP_ROOT, "app");
const ALLOWLIST = join(HERE, "never-as-text.allowlist.json");

// Tokens (and their aliases / raw hexes) that must never be text/icon color.
const FORBIDDEN = [
  "--harvest-gold",
  "--harvest-gold-deep",
  "--gold",
  "--gold-deep",
  "--midnight-bark",
  "#EDD682",
  "#C9B25C",
  "#CCA75C",
];
// Properties that render a token as text/icon foreground.
const FG_PROPS = ["color", "fill", "-webkit-text-fill-color", "caret-color"];

function walkCss(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walkCss(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

// Returns array of { file, selector, decl } for every forbidden foreground use.
function scan(file) {
  const src = readFileSync(file, "utf8");
  const rel = relative(APP_ROOT, file);
  const hits = [];
  // Extremely small tokenizer: we only need to know which selector block a
  // declaration sits in. Selector text is everything since the last `}` or
  // `{`, up to the next `{`. `stack` is the single source of truth for the
  // current selector (its top entry).
  const parts = src.split(/([{}])/);
  let pending = "";
  const stack = [];
  for (const part of parts) {
    if (part === "{") {
      stack.push(pending.trim().replace(/\s+/g, " "));
      pending = "";
    } else if (part === "}") {
      stack.pop();
      pending = "";
    } else {
      pending = part;
      // Scan declarations inside the current block.
      if (stack.length) {
        for (const raw of part.split(";")) {
          const decl = raw.trim();
          if (!decl || decl.startsWith("/*")) continue;
          const m = decl.match(/^([-a-z]+)\s*:\s*(.+)$/i);
          if (!m) continue;
          const prop = m[1].toLowerCase();
          const val = m[2];
          if (!FG_PROPS.includes(prop)) continue;
          if (FORBIDDEN.some((t) => val.toLowerCase().includes(t.toLowerCase()))) {
            hits.push({
              file: rel,
              selector: stack[stack.length - 1],
              decl: `${prop}: ${val.trim()}`,
            });
          }
        }
      }
    }
  }
  return hits;
}

const found = walkCss(CSS_ROOT).flatMap(scan);
const sig = (h) => `${h.file} :: ${h.selector} :: ${h.decl}`;
const foundSigs = [...new Set(found.map(sig))].sort();

if (process.argv.includes("--update")) {
  writeFileSync(
    ALLOWLIST,
    JSON.stringify(
      {
        _comment:
          "GOL-108 never-as-text baseline. Each entry is an EXISTING color/fill use of a light-on-light brand token. Adding a NEW entry means you are putting gold/tan text on a surface — it MUST be a dark surface, and you must re-run --update to record it. See BRAND-A11Y.md. Existing entries are audited at render time under GOL-106.",
        tokens: FORBIDDEN,
        allow: foundSigs,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`✔ baseline written: ${foundSigs.length} entries → ${relative(APP_ROOT, ALLOWLIST)}`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
} catch {
  console.error(
    `✘ never-as-text baseline missing (${relative(APP_ROOT, ALLOWLIST)}). Run: node scripts/check-never-as-text.mjs --update`,
  );
  process.exit(1);
}
const allow = new Set(baseline.allow || []);
const drift = foundSigs.filter((s) => !allow.has(s));

if (drift.length) {
  console.error("✘ never-as-text guardrail: new gold/tan text/icon color(s) detected.\n");
  console.error(
    "  These tokens are light-on-light (harvest-gold 1.35:1, gold-deep 1.97:1,\n" +
      "  midnight-bark 2.13:1 on ivory) and fail WCAG 1.4.3 as text on light surfaces.\n" +
      "  See apps/goldberry/BRAND-A11Y.md.\n",
  );
  for (const d of drift) console.error(`    + ${d}`);
  console.error(
    "\n  If this text truly sits on a DARK surface (verified ≥4.5:1), record it:\n" +
      "    node scripts/check-never-as-text.mjs --update\n",
  );
  process.exit(1);
}
console.log(`✔ never-as-text guardrail passed (${foundSigs.length} known foreground uses, 0 drift).`);
