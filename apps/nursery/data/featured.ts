// Lead-seller curation for the At The Grove Nursery homepage (GOL-659).
//
// Josh's direction: feature our main sellers — currently Fig, Apple,
// Serviceberry, Mulberry — but "this set changes over time," so it must be
// data-driven, not hardcoded markup. This module is the single, swappable
// source of truth: edit LEAD_SELLERS to reshape the hero line-up and the
// homepage re-selects from whatever the live catalog returns. Nothing in the
// markup names a specific tree.

import type { Product } from "@grove/odoo-client";

/**
 * Ordered curated line-up. Each term is matched — case- and
 * whitespace-insensitive — against a product's slug, name, and tags, so
 * "serviceberry" catches both "Serviceberry" and "Service Berry". Reorder or
 * edit this list to change the featured row with demand/season; no component
 * changes required.
 */
export const LEAD_SELLERS = ["fig", "apple", "serviceberry", "mulberry"] as const;

/** How many cards the featured row shows. */
export const FEATURED_LIMIT = 4;

/**
 * On-sale overlay — nursery-local until the catalog API exposes a discount /
 * compare-at price. Keyed by a product's normalized slug or name;
 * `compareAtPrice` is the pre-sale price struck through on the card, while the
 * live sale price is the product's own price.
 *
 * We do NOT fabricate discounts on real products (that would be a dark
 * pattern): the only entry below is keyed to a mock-catalog slug that no live
 * Odoo product carries, so the accessible on-sale treatment is demonstrable in
 * local/offline builds while live/QA shows a sale only when a product is
 * genuinely discounted. Once Odoo models a discount field, map it in
 * @grove/odoo-client's normalizer and read `product.compareAtPrice` directly.
 * See the GOL-659 follow-up for the Odoo field.
 */
export const SALE_OVERRIDES: Record<string, { compareAtPrice: number }> = {
  // Mock-only ("Montmorency Sour Cherry", GN-CHR-003) — no live product
  // normalizes to this token, so it can never mislabel a real listing.
  montmorencysourcherry: { compareAtPrice: 58 },
};

/** A catalog product enriched with the homepage's sale decision. */
export interface LeadSeller extends Product {
  /** True when a compare-at price is known and above the current price. */
  onSale: boolean;
  /** Pre-sale price to strike through; null when not on sale. */
  compareAtPrice: number | null;
}

/** Fold a label down to a comparable token: lowercase, alphanumerics only. */
function normToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Tokens a product can be matched by: its slug, name, and each tag. */
function tokensFor(p: Product): string[] {
  return [p.slug, p.name, ...(p.tags ?? [])]
    .filter(Boolean)
    .map(normToken);
}

function matches(p: Product, term: string): boolean {
  const t = normToken(term);
  return tokensFor(p).some((tok) => tok.includes(t));
}

/** Card price to display — the lowest variant price ("from $X") when known,
 *  else the product's own price. */
export function displayPrice(p: Product): number {
  return typeof p.priceMin === "number" ? p.priceMin : p.price;
}

function saleFor(p: Product): { compareAtPrice: number } | undefined {
  return SALE_OVERRIDES[normToken(p.slug)] ?? SALE_OVERRIDES[normToken(p.name)];
}

function withSale(p: Product): LeadSeller {
  const override = saleFor(p);
  const onSale = !!override && override.compareAtPrice > displayPrice(p);
  return {
    ...p,
    onSale,
    compareAtPrice: onSale ? override!.compareAtPrice : null,
  };
}

// Higher score = stronger candidate. Availability dominates so we never lead
// with a sold-out card; on-sale and Odoo-`grove_featured` break ties.
function scoreForFeature(p: LeadSeller): number {
  return (p.available ? 4 : 0) + (p.onSale ? 2 : 0) + (p.featured ? 1 : 0);
}

/**
 * Choose the featured row from the live catalog.
 *
 *  1. Walk LEAD_SELLERS in order; for each, take the strongest matching
 *     product the catalog actually has.
 *  2. If the catalog is missing some lead sellers, backfill so the row is
 *     never short — on-sale first, then Odoo-featured, then anything in stock.
 *
 * Result is de-duplicated and capped at `limit`.
 */
export function selectLeadSellers(
  products: Product[],
  limit = FEATURED_LIMIT,
): LeadSeller[] {
  const enriched = products.map(withSale);
  const chosen: LeadSeller[] = [];
  const used = new Set<number>();

  const take = (p: LeadSeller | undefined) => {
    if (p && !used.has(p.id) && chosen.length < limit) {
      used.add(p.id);
      chosen.push(p);
    }
  };

  for (const term of LEAD_SELLERS) {
    const best = enriched
      .filter((p) => !used.has(p.id) && matches(p, term))
      .sort((a, b) => scoreForFeature(b) - scoreForFeature(a))[0];
    take(best);
  }

  if (chosen.length < limit) {
    const backfill = enriched
      .filter((p) => !used.has(p.id))
      .sort((a, b) => scoreForFeature(b) - scoreForFeature(a));
    for (const p of backfill) take(p);
  }

  return chosen;
}
