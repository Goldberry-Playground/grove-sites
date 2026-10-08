import type { Product, PromotionTier } from "@grove/odoo-client";

/**
 * Deal badges (GOL-2745, spec decision 5 — "deals are badges, not a place").
 *
 * There is no Deals page: a discount-driven aisle reads as a clearance rack and
 * sits empty between promotions. Instead the automatic volume tiers already
 * running in Odoo (GOL-2431/2432) surface as a small badge on the card, and the
 * "On offer" facet appears only when something in view actually is.
 */

/**
 * Badge text for the lowest volume tier — "5+ save" for a program whose first
 * tier starts at 5 qualifying trees. Returns null when the program has no
 * tiers, which is also what a backend that predates `/promotions/auto` and an
 * unreachable Odoo both produce (the client swallows those to `[]`), so a
 * missing program can never invent a discount that isn't there.
 */
export function dealBadgeLabel(tiers: PromotionTier[]): string | null {
  if (tiers.length === 0) return null;
  const lowest = tiers.reduce((min, t) => (t.minQty < min.minQty ? t : min));
  if (!Number.isFinite(lowest.minQty) || lowest.minQty < 2) return null;
  return `${lowest.minQty}+ save`;
}

/**
 * Whether a given product earns the badge.
 *
 * `qualifiesForVolume` is UNDEFINED on every backend until the field ships, and
 * undefined means "not reported", not "no". Today every published item is a
 * qualifying plant, so undefined is treated as qualifying — and the moment Odoo
 * starts reporting, an explicit `false` (a gift card, a supply item) switches
 * its badge off with no storefront change. A product that can't be bought at
 * all never carries one.
 */
export function showsDealBadge(product: Product): boolean {
  if (product.qualifiesForVolume === false) return false;
  if (product.saleOk === false) return false;
  return true;
}

/**
 * True when at least one product in the current view is on offer — the gate for
 * rendering the "On offer" facet at all. `onOffer` is undefined on a backend
 * that doesn't report offers, which reads as "not on offer": the facet stays
 * hidden rather than shipping a filter that always returns nothing.
 */
export function anyOnOffer(products: Product[]): boolean {
  return products.some((p) => p.onOffer === true);
}

/** Narrow a list to the on-offer products (the `?offer=1` facet). */
export function filterOnOffer(products: Product[], active: boolean): Product[] {
  if (!active) return products;
  return products.filter((p) => p.onOffer === true);
}
