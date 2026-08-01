/**
 * One badge in a cart/checkout trust strip: a short reassurance paired with a
 * decorative glyph. The icon is `aria-hidden` wherever it renders, so meaning
 * never rides on the glyph (or its color) alone — the text always carries it.
 *
 * The copy itself is brand-owned: the shared `@grove/checkout` wrappers pick a
 * per-brand set so each storefront only makes claims true for its products
 * (GOL-1090).
 */
export interface GroveTrustItem {
  /** Decorative glyph (rendered `aria-hidden`). */
  icon: string;
  /** The reassurance text — the accessible, meaning-bearing part. */
  text: string;
}
