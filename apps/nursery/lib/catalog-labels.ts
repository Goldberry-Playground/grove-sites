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
 * variant product (e.g. Aronia, pending its potted/bareroot data) keeps the
 * card's vertical rhythm aligned with its multi-variety neighbours.
 *
 * Note: `variantCount` counts Odoo *variants* (cultivar × format), which is why
 * the label is "varieties" (breadth), not "cultivars" (a stricter, unavailable
 * count on the list card).
 */
export function variantCountLabel(variantCount?: number): string {
  return typeof variantCount === "number" && variantCount > 1
    ? `${variantCount} varieties`
    : "1 variety";
}

/** Catalog-level count of distinct plant products (not variants). */
export function plantCountLabel(count: number): string {
  return `${count} ${count === 1 ? "plant" : "plants"}`;
}
