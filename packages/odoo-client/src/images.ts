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
