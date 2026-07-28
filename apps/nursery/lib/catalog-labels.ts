/**
 * Shared catalog copy — single source of truth for the "plants" vs "varieties"
 * distinction so the term stops being overloaded across surfaces (GOL-679).
 *
 *   • CATALOG level counts distinct plant products  → "plants"
 *       (shop header, homepage hero stat, "browse all" footer)
 *   • CARD level counts the varietal breadth within one plant → "varieties"
 *       (the per-card metadata subtitle)
 *
 * Card metadata is rendered for every product — including single-variant ones
 * like Aronia — so the grid never reads ragged when a product has one option.
 */

/**
 * Metadata subtitle for a catalog card. Always returns a line so a single-
 * variety product (e.g. Aronia) keeps the card's vertical rhythm aligned with
 * its multi-variety neighbours.
 *
 * Pass the DISTINCT CULTIVAR count (`Product.cultivarCount`), not the raw Odoo
 * variant count. Every plant carries a Potted/Bareroot Format axis, so the
 * variant grid is cultivar × format — a single-cultivar plant has two variants
 * but is one variety (GOL-919). Callers fall back to `variantCount` only for
 * mocks / pre-GOL-919 payloads that predate the `cultivarCount` field.
 */
export function varietyCountLabel(cultivarCount?: number): string {
  return typeof cultivarCount === "number" && cultivarCount > 1
    ? `${cultivarCount} varieties`
    : "1 variety";
}

/** Catalog-level count of distinct plant products (not variants). */
export function plantCountLabel(count: number): string {
  return `${count} ${count === 1 ? "plant" : "plants"}`;
}
