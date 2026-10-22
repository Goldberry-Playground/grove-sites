/**
 * Canonical PDP URLs (GOL-3601, GOL-2875 §3 R1–R8).
 *
 * `/shop/<slug>` is the canonical product URL and `/shop/<id>` 301s to it. Every
 * link the storefront renders should go through `productPath()` so a card never
 * spends the shopper's click on a redirect hop.
 */

/**
 * A slug the PDP route can serve. It must be non-empty, lowercase kebab-case,
 * and NOT all digits: an all-digit segment is read as a product id, so a
 * numeric slug could never be reached.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isUsableSlug(slug: string | null | undefined): slug is string {
  return typeof slug === "string" && SLUG_RE.test(slug) && !/^\d+$/.test(slug);
}

/** True when a `/shop/<segment>` value is the legacy numeric product id form. */
export function isProductIdSegment(segment: string): boolean {
  return /^\d+$/.test(segment);
}

/**
 * Site-relative PDP path for a product. Prefers the slug. A product with a
 * blank or unusable `grove_slug` falls back to its id path, which the route
 * serves `noindex` instead of 404ing, because commerce fails open (R4).
 */
export function productPath(product: { id: number; slug?: string | null }): string {
  return isUsableSlug(product.slug) ? `/shop/${product.slug}` : `/shop/${product.id}`;
}
