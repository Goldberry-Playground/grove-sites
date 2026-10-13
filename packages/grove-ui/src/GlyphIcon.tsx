/**
 * The non-trust UI marks — arrows, the error warning, the stepper signs — drawn
 * as geometry instead of typed as characters (GOL-3123).
 *
 * Third instance of the GOL-3112 / GOL-3117 defect. The storefronts load only
 * Fraunces, Newsreader and IBM Plex Mono; U+2192, U+2190 and U+26A0 are in
 * Arrows and Miscellaneous Symbols, which none of the
 * three cover — verified by reading each face's `cmap`, not by eye. They resolve
 * through system fallback, so they look correct on
 * every machine we develop on and paint an empty .notdef box on a client with no
 * symbol font.
 *
 * Sibling of `<TrustIcon>`, kept separate on purpose: `GroveTrustIconName` is a
 * closed set that `brand-trust.ts` is checked against, and widening it with
 * shapes no trust badge may use would weaken that guard. Same 12x12 /
 * `currentColor` / `em` contract, so the two read as one system.
 *
 * Every mark here is decorative — `aria-hidden`, with the button label, link
 * text or error message carrying the meaning. A sign that is *part of a number*
 * is deliberately NOT in this list: the discount row on `CheckoutPage` keeps a
 * real U+2212, both because the sign belongs to the number (selectable,
 * copyable, announced with the amount) and because all three faces carry that
 * codepoint — the one glyph GOL-3123 set out to fix and found was never broken.
 */
export type GroveGlyphIconName =
  | "arrow-right"
  | "arrow-left"
  | "warning"
  // GOL-2797: the surfaces GOL-3123 left on its follow-up list (the order
  // review step, cancel page, sibling strip and nursery CTAs).
  | "arrow-down"
  | "caret-down"
  | "undo"
  | "dot"
  | "clock";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<GroveGlyphIconName, React.ReactNode> = {
  // U+2192 RIGHTWARDS ARROW — shaft plus an open chevron head, like the glyph.
  "arrow-right": (
    <>
      <path d="M1.25 6h9" {...STROKE} />
      <path d="M6.9 2.4 10.5 6l-3.6 3.6" {...STROKE} />
    </>
  ),
  // U+2190 LEFTWARDS ARROW — the same mark mirrored.
  "arrow-left": (
    <>
      <path d="M10.75 6h-9" {...STROKE} />
      <path d="M5.1 2.4 1.5 6l3.6 3.6" {...STROKE} />
    </>
  ),
  // U+26A0 WARNING SIGN — rounded triangle with the bar-and-dot inside. Drawn,
  // not filled-solid, to match the outline weight of the glyph it replaces.
  warning: (
    <>
      <path d="M6 1.15 11.3 10.4H0.7Z" {...STROKE} />
      <path d="M6 4.9v2.1" {...STROKE} />
      <path d="M6 8.75h0.01" {...STROKE} strokeWidth={1.6} />
    </>
  ),
  // U+2193 DOWNWARDS ARROW (`&darr;`) — the right arrow turned a quarter.
  "arrow-down": (
    <>
      <path d="M6 1.25v9" {...STROKE} />
      <path d="M2.4 6.9 6 10.5l3.6-3.6" {...STROKE} />
    </>
  ),
  // U+25BE BLACK DOWN-POINTING SMALL TRIANGLE — the disclosure caret.
  "caret-down": <path d="M2.75 4.25h6.5L6 8.25Z" fill="currentColor" />,
  // U+21A9 LEFTWARDS ARROW WITH HOOK — the "go back" mark on the cancel page.
  undo: (
    <>
      <path d="M10.25 2v3.25A2.75 2.75 0 0 1 7.5 8H1.75" {...STROKE} />
      <path d="M4.6 5.15 1.75 8l2.85 2.85" {...STROKE} />
    </>
  ),
  // U+25CF BLACK CIRCLE — a solid dot.
  dot: <circle cx="6" cy="6" r="4.25" fill="currentColor" />,
  // U+25F7 WHITE CIRCLE WITH UPPER RIGHT QUADRANT — a ring with the quadrant
  // ruled off, which is why it reads as a clock face.
  clock: (
    <>
      <circle cx="6" cy="6" r="5" {...STROKE} strokeWidth={1.25} />
      <path d="M6 1v5h5" {...STROKE} strokeWidth={1.25} />
    </>
  ),
};

export interface GlyphIconProps {
  name: GroveGlyphIconName;
  className?: string;
}

export function GlyphIcon({ name, className }: GlyphIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      className={className}
      // flexShrink is load-bearing — GOL-3117 shipped a half-circle that drew as
      // an ellipse because a 1em box inside an inline-flex row was allowed to
      // shrink to 8x12 at 390px. A 1em box that can shrink is not a 1em box.
      style={{
        width: "1em",
        height: "1em",
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "-0.125em",
      }}
    >
      {PATHS[name]}
    </svg>
  );
}
