/**
 * Resolve a product image URL from the grove_headless API into something
 * next/image can load.
 *
 * The API returns Odoo-relative paths (`/web/image/product.template/<id>/
 * image_128`). Those must be made absolute against the Odoo host — left
 * relative, the browser requests them from the storefront's own domain and
 * 404s (bit QA on 2026-07-07). App-local static assets (any other leading-/
 * path such as `/products/...`, `/hero/...`, `/photos/...`), absolute URLs,
 * and data: URIs pass through unchanged.
 *
 * PRODUCTION NOTE: the assets CDN (assets.gatheringatthegrove.com → DO
 * Spaces, built in Phase A) is the intended front for photo traffic at
 * production scale — either by teaching this resolver a CDN base that
 * mirrors/caches `/web/image/*`, or by syncing curated product photos into
 * the bucket. Serving straight from the Odoo host is fine for QA volume;
 * revisit before prod cutover so the droplet doesn't take image traffic.
 */
export function resolveOdooImageUrl(
  imageUrl: string | null | undefined,
  odooBase: string,
): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("/web/image")) return `${odooBase}${imageUrl}`;
  if (
    imageUrl.startsWith("http") ||
    imageUrl.startsWith("data:") ||
    imageUrl.startsWith("/")
  ) {
    return imageUrl;
  }
  // Defensive: bare Odoo-ish paths without a leading slash
  return `${odooBase}${imageUrl}`;
}

// Odoo stores each image at a fixed ladder of pre-scaled resolutions and
// exposes them by suffixing the field name (`image_128` … `image_1920`).
// See https://www.odoo.com/documentation — `image.mixin`.
export const ODOO_IMAGE_SIZES = [128, 256, 512, 1024, 1920] as const;
export type OdooImageSize = (typeof ODOO_IMAGE_SIZES)[number];

/**
 * Swap the resolution of an Odoo image path to a larger (or smaller) size.
 *
 * The product *list* endpoint returns thumbnail paths (`.../image_128`),
 * while the *detail* endpoint returns `.../image_1920`. On the shop grid the
 * cards render each image up to ~380 CSS px (≈760 device px on retina), so a
 * 128 px source is upscaled by next/image and reads as blurry (GOL-761). The
 * bytes live at every rung of the ladder regardless of which path the API
 * hands back, so rewriting the suffix lets us request a source large enough
 * for next/image to downscale cleanly.
 *
 * Only Odoo `image_<n>` paths are rewritten; app-local assets, absolute URLs,
 * and data: URIs (which have no resolution ladder) pass through untouched.
 */
export function withOdooImageSize(
  imageUrl: string | null | undefined,
  size: OdooImageSize,
): string {
  if (!imageUrl) return "";
  return imageUrl.replace(/image_(?:128|256|512|1024|1920)\b/, `image_${size}`);
}
