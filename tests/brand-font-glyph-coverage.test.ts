// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Repo-wide invariant for GOL-2797: rendered markup may not contain a character
 * the brand webfonts cannot draw.
 *
 * The nursery loads Fraunces / Newsreader / IBM Plex Mono from Google Fonts.
 * Google serves those as subsets, and each `@font-face` declares the exact
 * `unicode-range` it covers. A codepoint outside every declared range is not
 * merely "missing from the file" — the browser will not even consider that face
 * for it, on any platform. It falls through the rest of the stack
 * ("Cormorant Garamond" → Georgia → whatever the OS has) and ends at a symbol
 * font we do not control, or at tofu (▯) on a machine without one.
 *
 * That is why this rule is not "looks fine on my Mac". It is deterministic from
 * the served `unicode-range`, and it bit us in the primary checkout CTA
 * ("Continue to payment →") and in both error icons (⚠).
 *
 * The fix is never to widen the font request — it is to draw the mark as an
 * inline SVG from `@grove/ui-kit`'s icon set (`ArrowRight`, `WarningIcon`,
 * `CheckIcon`, …), which renders in a face we control, inherits `currentColor`,
 * and sizes in `em`. If you need a mark this set lacks, add it there rather than
 * typing the character into markup.
 */

const REPO = path.resolve(__dirname, "..");

/**
 * Union of the `unicode-range`s Google Fonts actually serves for our families
 * (the latin, latin-ext and vietnamese subsets), captured 2026-09-30 from
 * `fonts.googleapis.com/css2?family=Fraunces…&family=Newsreader…` under a
 * desktop Chrome UA.
 *
 * Note U+2191/U+2193 (up/down arrows) ARE served while U+2190/U+2192
 * (left/right) are NOT — the gap is deliberate upstream, not an accident, and
 * is precisely the trap this guard exists to catch.
 */
const SERVED: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x00ff], [0x0100, 0x02ba], [0x02bb, 0x02bc], [0x02bd, 0x02c5],
  [0x02c6, 0x02c6], [0x02c7, 0x02cc], [0x02ce, 0x02d7], [0x02da, 0x02da],
  [0x02dc, 0x02dc], [0x02dd, 0x02ff], [0x0300, 0x0301], [0x0303, 0x0304],
  [0x0308, 0x0309], [0x0323, 0x0323], [0x0329, 0x0329], [0x0131, 0x0131],
  [0x0152, 0x0153], [0x1d00, 0x1dbf], [0x1e00, 0x1e9f], [0x1ea0, 0x1ef9],
  [0x1ef2, 0x1eff], [0x2000, 0x206f], [0x2020, 0x2020], [0x20a0, 0x20c0],
  [0x2113, 0x2113], [0x2122, 0x2122], [0x2191, 0x2191], [0x2193, 0x2193],
  [0x2212, 0x2212], [0x2215, 0x2215], [0x2c60, 0x2c7f], [0xa720, 0xa7ff],
  [0xfeff, 0xfeff], [0xfffd, 0xfffd],
];

function isServed(cp: number): boolean {
  return SERVED.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/**
 * Surfaces this rule covers: the shared UI kit and the checkout/cart package
 * (which render on every storefront), plus the nursery app — the storefront
 * that is live. The other apps carry the same defect and are tracked separately;
 * add them here as they are cleaned up.
 */
const ROOTS = [
  "packages/grove-ui/src",
  "packages/checkout/src",
  "apps/nursery/app",
  "apps/nursery/data",
];

const SOURCE_EXT = new Set([".ts", ".tsx"]);

/**
 * Stylesheets get the same rule, but only for `content:` — a generated marker
 * is painted exactly like a character in markup. This half of the guard is not
 * hypothetical: a `content: '\u25D0  '` on the sibling-strip's current-site pill
 * survived the first pass of the markup sweep and was still rendering tofu at
 * the top of every nursery page.
 */
const STYLE_EXT = new Set([".css"]);
const CONTENT_DECL = /content\s*:\s*(["'])((?:(?!\1).)*)\1/g;

function sourceFiles(root: string): string[] {
  const abs = path.join(REPO, root);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(entry);
      if (!SOURCE_EXT.has(ext) && !STYLE_EXT.has(ext)) continue;
      // Tests may name a glyph in order to assert something about it.
      if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
      out.push(full);
    }
  };
  walk(abs);
  return out;
}

/**
 * Strip the parts of a source file a browser never paints: comments, and
 * `import`/`export … from` specifiers. Prose in a comment may legitimately use
 * an arrow ("state → zone map"); markup may not.
 */
function renderable(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*(import|export)\s[^\n]*from\s*["'][^"']*["'][^\n]*$/gm, "");
}

describe("brand font glyph coverage (GOL-2797)", () => {
  const offenders: string[] = [];

  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const raw = readFileSync(file, "utf8");
      // A stylesheet is only checked for what it actually paints.
      const text = STYLE_EXT.has(path.extname(file))
        ? [...raw.matchAll(CONTENT_DECL)].map((m) => m[2]).join("\n")
        : renderable(raw);
      text.split("\n").forEach((line, i) => {
        for (const ch of line) {
          const cp = ch.codePointAt(0)!;
          if (cp < 0x80 || isServed(cp)) continue;
          const where = STYLE_EXT.has(path.extname(file))
            ? `${path.relative(REPO, file)} (content:)`
            : `${path.relative(REPO, file)}:${i + 1}`;
          offenders.push(
            `${where}  U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${ch}`,
          );
        }
      });
    }
  }

  it("finds source to check", () => {
    expect(ROOTS.flatMap(sourceFiles).length).toBeGreaterThan(50);
  });

  it("renders no character outside the served font subsets", () => {
    expect(
      offenders,
      `These characters are outside every unicode-range our brand faces are served with, ` +
        `so the browser will paint them in an uncontrolled fallback font (or as tofu). ` +
        `Use an inline SVG icon from @grove/ui-kit instead:\n  ${offenders.join("\n  ")}\n`,
    ).toEqual([]);
  });

  it("agrees with the upstream quirk that ↑/↓ are served but ←/→ are not", () => {
    expect([0x2191, 0x2193].every(isServed)).toBe(true);
    expect([0x2190, 0x2192].some(isServed)).toBe(false);
  });
});
