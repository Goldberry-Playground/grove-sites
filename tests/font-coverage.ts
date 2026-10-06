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
 *
 * GOL-3123 added `characterRefOffenders`: a scan of literal characters alone is
 * not enough, because `&rarr;` is ASCII in the source and U+2192 in the browser.
 * Eight such references sit in the nursery, ggg and goldberry routes today,
 * invisible to the first version of this check.
 */

/**
 * Characters above Latin-1 that Fraunces / Newsreader / IBM Plex Mono all
 * cover. Adding to this list is a claim that all three faces carry the glyph —
 * verify it against the font files before you do.
 *
 * Every entry below was verified that way on 2026-10-05 (GOL-3123): the three
 * faces pulled from Google Fonts and each one's `cmap` read directly. Two
 * results worth keeping:
 *
 *   - U+2212 MINUS SIGN is carried by all three, so it is listed here. GOL-3123
 *     opened on the belief that the discount line's U+2212 was tofu and that a
 *     discount therefore read as a positive charge. It was not. Google's
 *     standard Latin set includes the math operators (−, ×, ÷, ±) and excludes
 *     the arrows, which is exactly the line between what is safe here and what
 *     is not.
 *   - U+2192 / U+2190 are in IBM Plex Mono but in NEITHER serif. Coverage has to
 *     be read per element's own font stack: an arrow in a Fraunces button falls
 *     to `Cormorant Garamond, Georgia, serif`, and a loaded mono face it cannot
 *     reach does not save it. "One of the three has it" is not coverage.
 */
export const COVERED_ABOVE_LATIN1 = new Map<number, string>([
  [0x2013, "en dash"],
  [0x2212, "minus sign"],
  [0x2014, "em dash"],
  [0x2018, "left single quote"],
  [0x2019, "right single quote / apostrophe"],
  [0x201c, "left double quote"],
  [0x201d, "right double quote"],
  [0x2026, "ellipsis"],
  // Also cmap-verified in all three on 2026-10-05, and in use on live routes,
  // so the guard would otherwise cry wolf over them (GOL-3123).
  [0x2022, "bullet"],
  [0x2039, "single left angle quote"],
  [0x203a, "single right angle quote"],
  [0x2116, "numero sign"],
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
  /** Resolved codepoint, or `null` for a named reference we cannot resolve. */
  cp: number | null;
  char: string;
  line: number;
  known?: string;
  /** Set when the offender was written as `&…;` rather than as the character. */
  ref?: string;
}

export const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * Named character references whose codepoint all three faces cover.
 *
 * Anything else written as `&…;` is reported, including references this table
 * simply does not know. That is deliberate: the point of the check is that you
 * can read the source and tell what paints, and `&hearts;` defeats that just as
 * thoroughly as `&minus;` does. Spell the character or draw it.
 */
export const COVERED_ENTITIES = new Map<string, number>([
  ["amp", 0x26],
  ["apos", 0x27],
  ["quot", 0x22],
  ["lt", 0x3c],
  ["gt", 0x3e],
  ["nbsp", 0xa0],
  ["copy", 0xa9],
  ["reg", 0xae],
  ["deg", 0xb0],
  ["ndash", 0x2013],
  ["mdash", 0x2014],
  ["lsquo", 0x2018],
  ["rsquo", 0x2019],
  ["ldquo", 0x201c],
  ["rdquo", 0x201d],
  ["hellip", 0x2026],
  // Carried by all three faces — see COVERED_ABOVE_LATIN1's note (GOL-3123).
  ["minus", 0x2212],
  ["times", 0xd7],
  ["divide", 0xf7],
  ["plusmn", 0xb1],
  ["bull", 0x2022],
]);

/** The uncovered references seen in this repo, so a failure names the mark. */
const NAMED_CODEPOINTS = new Map<string, number>([
  ["rarr", 0x2192],
  ["larr", 0x2190],
  ["uarr", 0x2191],
  ["darr", 0x2193],
  ["harr", 0x2194],
  ["check", 0x2713],
  ["starf", 0x2605],
  ["dagger", 0x2020],
  ["trade", 0x2122],
]);

const REF = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/g;

/**
 * Characters smuggled past the codepoint scan as HTML character references.
 *
 * GOL-3123 found this hole the hard way: the cart quantity stepper rendered
 * `&minus;` — U+2212 — so the source was pure ASCII, the GOL-3117 guard passed
 * it, and the decrement button still painted an empty box next to a real `+` on
 * a device with no symbol font. A reference is exactly as uncovered as the
 * character it stands for; it is only harder to see.
 */
export function characterRefOffenders(src: string): Offender[] {
  const out: Offender[] = [];
  stripComments(src)
    .split("\n")
    .forEach((text, i) => {
      for (const m of text.matchAll(REF)) {
        const body = m[1];
        const line = i + 1;
        if (body.startsWith("#")) {
          const cp = body[1] === "x" || body[1] === "X"
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
          if (!Number.isFinite(cp) || cp <= 0xff || COVERED_ABOVE_LATIN1.has(cp)) continue;
          const char = String.fromCodePoint(cp);
          out.push({ cp, char, line, known: KNOWN_TOFU.get(char), ref: m[0] });
          continue;
        }
        if (COVERED_ENTITIES.has(body)) continue;
        const cp = NAMED_CODEPOINTS.get(body) ?? null;
        const char = cp === null ? "" : String.fromCodePoint(cp);
        out.push({ cp, char, line, known: KNOWN_TOFU.get(char), ref: m[0] });
      }
    });
  return out;
}

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
  // A reference paints the same box as the literal character, so the two belong
  // in one verdict — otherwise a file can be "clean" and still tofu (GOL-3123).
  return [...out, ...characterRefOffenders(src)].sort((a, b) => a.line - b.line);
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
      .map((o) => {
        const what = o.cp === null ? "unresolved reference" : `${hex(o.cp)} ${o.char}`;
        const via = o.ref ? ` written as ${o.ref}` : "";
        return `  L${o.line}: ${what}${via}${o.known ? ` — ${o.known}` : ""}`;
      })
      .join("\n")
  );
}
