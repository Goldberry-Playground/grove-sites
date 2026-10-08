/**
 * One badge in a cart/checkout trust strip: a short reassurance paired with a
 * decorative icon. The icon is `aria-hidden` wherever it renders, so meaning
 * never rides on the glyph (or its color) alone — the text always carries it.
 *
 * The copy itself is brand-owned: the shared `@grove/checkout` wrappers pick a
 * per-brand set so each storefront only makes claims true for its products
 * (GOL-1090).
 */
export interface GroveTrustItem {
  /** Which decorative shape to draw (rendered `aria-hidden`, as inline SVG). */
  icon: GroveTrustIconName;
  /** The reassurance text — the accessible, meaning-bearing part. */
  text: string;
}

/**
 * The four trust-strip shapes, named rather than spelled as characters.
 *
 * This used to be a free `string` holding the literal glyph — `✦`, `◐`, `✓`,
 * `♦`. Those live in Dingbats, Geometric Shapes and Miscellaneous Symbols, and
 * the storefronts load only Fraunces / Newsreader / IBM Plex Mono, none of
 * which cover any of those blocks. Every badge therefore resolved through
 * system fallback and painted as an empty .notdef box on a client with no
 * symbol font (GOL-3117, same defect as GOL-3112 on the PDP estimator).
 *
 * Naming the shape instead of typing it makes the glyph unspellable at the call
 * site and moves the drawing to `<TrustIcon>`, which is pure geometry and
 * depends on no font at all. The names describe the mark, not its meaning, so
 * the per-brand copy stays the only thing that claims anything.
 */
export type GroveTrustIconName = "sparkle" | "half-circle" | "check" | "diamond";
