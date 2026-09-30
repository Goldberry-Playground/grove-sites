import type { GroveTrustIconName } from "./icons";

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
  /**
   * Which decorative icon to draw, named from the set `@grove/ui` ships.
   * Named rather than a literal character because the brand faces do not carry
   * arbitrary symbol codepoints (GOL-2797).
   */
  icon: GroveTrustIconName;
  /** The reassurance text — the accessible, meaning-bearing part. */
  text: string;
}
