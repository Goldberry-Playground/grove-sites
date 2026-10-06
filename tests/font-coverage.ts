/**
 * Shared font-coverage checker (GOL-3117).
 *
 * The storefronts load exactly three faces — Fraunces, Newsreader and IBM Plex
 * Mono. A character outside all three does not fail to render; it falls through
 * to whatever symbol font the *device* happens to have. macOS and Windows
 * usually have one, so a glyph like `✓` looks correct on every machine we
 * develop on and paints as an empty .notdef box on a client that has none.
 *
 * That is how GOL-3112 (PDP estimator) and GOL-3117 (zone-check, both checkout
 * trust strips, order-success, two globals.css eyebrows) shipped and survived
 * review. GOL-3112 proved the mechanism directly: a cmap read of the render
 * stack's faces showed no coverage for U+2713 or U+24D8, and both characters
 * drew at exactly the .notdef advance width. This module replaces "render it and
 * look" with something CI can check, by allowing only the blocks our faces cover.
 *
 * It is deliberately NOT a brand-voice rule. U+2014 is allowed here; the em-dash
 * guard is GOL-3065's lane and lives in the copy tests.
 */

/**
 * Characters above Latin-1 that Fraunces / Newsreader / IBM Plex Mono all
 * cover. General Punctuation only, and only the handful of marks the Grove voice
 * actually uses. Adding to this list is a claim that all three faces carry the
 * glyph — verify it against the font files before you do.
 */
export const COVERED_ABOVE_LATIN1 = new Map<number, string>([
  [0x2013, "en dash"],
  [0x2014, "em dash"],
  [0x2018, "left single quote"],
  [0x2019, "right single quote / apostrophe"],
  [0x201c, "left double quote"],
  [0x201d, "right double quote"],
  [0x2026, "ellipsis"],
]);

/**
 * The specific characters this bug was made of, so a regression names itself
 * instead of just reporting a codepoint. Keyed by character.
 */
export const KNOWN_TOFU = new Map<string, string>([
  ["✓", "U+2713 CHECK MARK (Dingbats) — GOL-3112 / GOL-3117"],
  ["ⓘ", "U+24D8 CIRCLED LATIN SMALL LETTER I (Enclosed Alphanumerics) — GOL-3112"],
  ["✦", "U+2726 BLACK FOUR POINTED STAR (Dingbats) — GOL-3117"],
  ["♦", "U+2666 BLACK DIAMOND SUIT (Misc Symbols) — GOL-3117"],
  ["◐", "U+25D0 CIRCLE WITH LEFT HALF BLACK (Geometric Shapes) — GOL-3117"],
  ["●", "U+25CF BLACK CIRCLE (Geometric Shapes) — GOL-3117"],
  ["◷", "U+25F7 WHITE CIRCLE WITH UPPER RIGHT QUADRANT (Geometric Shapes) — GOL-3117"],
  ["✕", "U+2715 MULTIPLICATION X (Dingbats) — GOL-682 drew this one in CSS"],
  ["▸", "U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE — GOL-682 drew this one in CSS"],
]);

/**
 * Drop comments so only rendered code/copy remains — a comment may name a
 * codepoint in prose (several of these files now do, explaining the fix), and
 * nothing in a comment reaches a browser. Handles `/* *\/` (JSDoc and JSX
 * comment bodies alike) and `//` line comments, sparing `http://`.
 */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export interface Offender {
  cp: number;
  char: string;
  line: number;
  known?: string;
}

export const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

/** Every character in `src` that no loaded face covers, comments excluded. */
export function uncoveredGlyphs(src: string): Offender[] {
  const out: Offender[] = [];
  stripComments(src)
    .split("\n")
    .forEach((text, i) => {
      for (const char of text) {
        const cp = char.codePointAt(0)!;
        if (cp <= 0xff || COVERED_ABOVE_LATIN1.has(cp)) continue;
        out.push({ cp, char, line: i + 1, known: KNOWN_TOFU.get(char) });
      }
    });
  return out;
}

/** Assertion message that tells the next person what to do instead. */
export function explain(offending: Offender[]): string {
  return (
    "character(s) outside Fraunces / Newsreader / IBM Plex Mono. They resolve " +
    "through system fallback and paint as an empty box on a device with no " +
    "symbol font. Draw the mark instead — an inline SVG (GOL-3112, GOL-3117), " +
    "the bordered-circle ASCII construction (GOL-2973), or CSS geometry / an " +
    "SVG mask in a stylesheet (GOL-682, GOL-3117):\n" +
    offending
      .map((o) => `  L${o.line}: ${hex(o.cp)} ${o.char}${o.known ? ` — ${o.known}` : ""}`)
      .join("\n")
  );
}
