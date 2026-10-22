import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Font-coverage guard for the shipping-estimator panel (GOL-3112).
 *
 * `apps/nursery/app/layout.tsx` loads exactly three faces — Fraunces,
 * Newsreader and IBM Plex Mono. A character outside all three does not fail to
 * render; it falls through to whatever symbol font the *device* happens to
 * have. macOS and Windows usually have one, so a glyph like `✓` looks correct
 * on every machine we develop on and paints as an empty .notdef box on a Linux
 * client that has none.
 *
 * That is how `✓` U+2713 (Dingbats) and `ⓘ` U+24D8 (Enclosed Alphanumerics)
 * shipped in this panel and survived review: the only way to see the bug is to
 * render in a stack with no symbol font. This test replaces that with something
 * CI can check, by allowing only the blocks our faces actually cover.
 *
 * It is deliberately NOT a brand-voice rule. U+2014 is still present in this
 * file's copy and is GOL-3065's lane; the em-dash guard lives in
 * `product-view.copy.test.ts`. The only question here is "will this paint?".
 *
 * Code comments are stripped first — they may name a codepoint in prose, and
 * nothing in a comment reaches a browser.
 */

const SOURCE = path.join(__dirname, "shipping-estimator.tsx");

/**
 * Characters above Latin-1 that Fraunces / Newsreader / IBM Plex Mono all
 * cover. General Punctuation only, and only the handful of marks the Grove
 * voice actually uses. Adding to this list is a claim that all three faces
 * carry the glyph — verify it against the font before you do.
 */
const COVERED_ABOVE_LATIN1 = new Map<number, string>([
  [0x2013, "en dash"],
  [0x2014, "em dash"],
  [0x2018, "left single quote"],
  [0x2019, "right single quote / apostrophe"],
  [0x201c, "left double quote"],
  [0x201d, "right double quote"],
  [0x2026, "ellipsis"],
]);

/** Drop block and line comments so only rendered code/copy remains. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */, JSDoc, and {/* JSX */} bodies
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // line comments (spares http:// URLs)
}

interface Offender {
  cp: number;
  char: string;
  n: number;
}

function uncoveredGlyphs(src: string): Offender[] {
  const out: Offender[] = [];
  stripComments(src)
    .split("\n")
    .forEach((line, i) => {
      for (const char of line) {
        const cp = char.codePointAt(0)!;
        // Latin-1 and below is covered by every face we load.
        if (cp <= 0xff || COVERED_ABOVE_LATIN1.has(cp)) continue;
        out.push({ cp, char, n: i + 1 });
      }
    });
  return out;
}

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

describe("shipping-estimator.tsx — every rendered glyph is inside a loaded font", () => {
  it("uses no character outside Fraunces / Newsreader / IBM Plex Mono", () => {
    const offending = uncoveredGlyphs(readFileSync(SOURCE, "utf8"));

    expect(
      offending,
      "character(s) outside the three loaded faces; they will resolve through " +
        "system fallback and tofu on a device with no symbol font. Use an inline " +
        "SVG, or the bordered-circle ASCII construction from GOL-2973:\n" +
        offending.map(({ cp, char, n }) => `  L${n}: ${hex(cp)} ${char}`).join("\n"),
    ).toEqual([]);
  });

  it.each([
    ["U+2713 ✓", 0x2713, "✓", "Dingbats"],
    ["U+24D8 ⓘ", 0x24d8, "ⓘ", "Enclosed Alphanumerics"],
  ])("does not reintroduce %s — GOL-3112", (_label, cp, char, block) => {
    const rendered = stripComments(readFileSync(SOURCE, "utf8"));

    expect(
      rendered.includes(char as string),
      `${hex(cp as number)} ${char} is in ${block}, which none of the three ` +
        "loaded faces cover. It painted as tofu on a symbol-font-less device " +
        "(GOL-3112). The panel's eligibility states are colour-independent by " +
        "design, so the icon must be built from characters we actually ship.",
    ).toBe(false);
  });
});
