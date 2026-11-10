/**
 * Cache-age policy for product data.
 *
 * The tag strings mirror `PRODUCT_CATALOG_CACHE_TAG` and `productCacheTag()` in
 * `@grove/odoo-client`. They are matched here as strings so that the handler bundle
 * does not pull in the Odoo client.
 */

/** Hard maximum age of any product-data entry, wherever it is served from. */
export const PRODUCT_MAX_AGE_SECONDS = 600;

const CATALOG_TAG = "grove-catalog";
const PRODUCT_TAG_PREFIX = "grove-product-";

/** Valkey expiry for entries without a product tag. */
export const DEFAULT_TTL_SECONDS = 86_400;

/**
 * Maximum age in seconds for an entry carrying `tags`: 600 for product data (the
 * catalog tag or any per-product tag), otherwise `null` (no extra bound).
 */
export function maxAgeSeconds(tags: readonly string[]): number | null {
  return tags.some(isProductTag) ? PRODUCT_MAX_AGE_SECONDS : null;
}

function isProductTag(tag: string): boolean {
  if (tag === CATALOG_TAG) return true;
  return tag.startsWith(PRODUCT_TAG_PREFIX) && tag.length > PRODUCT_TAG_PREFIX.length;
}
