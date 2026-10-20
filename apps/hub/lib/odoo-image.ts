/**
 * GOL-3477 — Odoo image URL helpers for the marketplace grid.
 *
 * grove_headless hands the hub `/web/image/<model>/<id>/<field>` paths where
 * the field is one of Odoo's stored image.mixin variants (image_128 … image_1920).
 * The product LIST endpoint points at `image_128` (a 128 px thumbnail, blurry
 * once upscaled into a 220-300 px card on a 2x screen) while the DETAIL endpoint
 * the featured slot resolves through points at `image_1920` (the full upload,
 * ~186 KB for one QA photo). Neither is the right master for a card.
 *
 * `next/image` needs one source it can resize DOWN from, so the card re-points
 * any variant to `image_1024`: large enough for the widest card at 3x, and the
 * smallest variant that is. Odoo materialises every variant for any record
 * carrying a photo, so the swap is always safe for a URL that resolved at all.
 */

/** Odoo image.mixin variant we hand next/image as the card master. */
export const ODOO_CARD_IMAGE_FIELD = "image_1024";

const ODOO_IMAGE_VARIANT = /\/image_(?:128|256|512|1024|1920)(?=$|[?#])/;

/**
 * Re-point an Odoo `/web/image/...` path (or absolute URL) at `field`.
 * URLs that are not an Odoo image variant are returned untouched, so a CDN or
 * data URL never gets mangled.
 */
export function odooImageAt(url: string, field: string = ODOO_CARD_IMAGE_FIELD): string {
  return url.replace(ODOO_IMAGE_VARIANT, `/${field}`);
}

/**
 * `sizes` for a `.marketplace__grid` card photo. The grid is one full-width
 * column under the 720 px breakpoint (`.marketplace` pads `var(--grid)`, at
 * least 1rem a side) and never wider than the 300 px featured cap above it
 * (the 4-per-vendor rows stretch to ~287 px in the 1300 px container).
 */
export const MARKETPLACE_CARD_SIZES = "(max-width: 720px) calc(100vw - 2rem), 300px";

/**
 * Index of the first card in render order that actually has a photo, or -1.
 * That card's image is the grid's LCP candidate (GOL-3477), so it is the one
 * to load eager + fetchpriority=high. A photo-less card up front (e.g. the QA
 * E2E fixture) renders an empty frame, so skipping it is what keeps the hint
 * on the image the browser will really paint.
 */
export function firstPhotoIndex(items: ReadonlyArray<{ product: { imageUrl?: string | null } }>): number {
  return items.findIndex((it) => Boolean(it.product.imageUrl));
}
