import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  LEAD_SELLERS,
  FEATURED_LIMIT,
  selectLeadSellers,
  displayPrice,
} from "./featured";

/**
 * Selection rules for the homepage lead-seller row (GOL-659).
 *
 * The row is what the nursery leads with commercially, so the things worth
 * locking are: curated order, no duplicate cards, never padding with sold-out
 * stock, and never fabricating a sale badge on a real product.
 *
 * Fixture is fully specified and deliberately NOT cast `as Product` — the
 * annotation is the check. Same convention as lib/facets.test.ts.
 */
function product(
  id: number,
  overrides: Partial<Product> = {},
): Product {
  return {
    id,
    slug: `p-${id}`,
    name: `Product ${id}`,
    sku: null,
    description: null,
    seoDescription: null,
    price: 10,
    currency: "USD",
    imageUrl: "",
    categoryId: null,
    categoryName: null,
    tags: [],
    available: true,
    featured: false,
    variants: [],
    ...overrides,
  };
}

describe("selectLeadSellers", () => {
  it("returns the curated line-up in LEAD_SELLERS order", () => {
    const catalog = [
      product(1, { name: "Mulberry Tree", slug: "mulberry-tree" }),
      product(2, { name: "Brown Turkey Fig", slug: "brown-turkey-fig" }),
      product(3, { name: "Serviceberry", slug: "serviceberry" }),
      product(4, { name: "Honeycrisp Apple", slug: "honeycrisp-apple" }),
    ];

    expect(selectLeadSellers(catalog).map((p) => p.id)).toEqual([2, 4, 3, 1]);
    expect([...LEAD_SELLERS]).toEqual(["fig", "apple", "serviceberry", "mulberry"]);
  });

  it("matches case- and whitespace-insensitively across slug, name and tags", () => {
    const catalog = [
      product(1, { name: "Service Berry", slug: "service-berry" }),
      product(2, { name: "Unrelated", slug: "unrelated", tags: ["FIG"] }),
    ];

    const ids = selectLeadSellers(catalog).map((p) => p.id);
    expect(ids).toContain(1); // "Service Berry" -> serviceberry
    expect(ids).toContain(2); // tag "FIG" -> fig
  });

  it("never lists the same product twice when it matches several terms", () => {
    // One product that answers to both "fig" and "apple".
    const catalog = [
      product(1, { name: "Fig Apple Hybrid", slug: "fig-apple-hybrid" }),
      product(2, { name: "Plain Tree", slug: "plain-tree" }),
    ];

    const ids = selectLeadSellers(catalog).map((p) => p.id);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids.filter((id) => id === 1)).toHaveLength(1);
  });

  it("caps the row at the limit", () => {
    const catalog = Array.from({ length: 12 }, (_, i) => product(i + 1));
    expect(selectLeadSellers(catalog)).toHaveLength(FEATURED_LIMIT);
    expect(selectLeadSellers(catalog, 2)).toHaveLength(2);
  });

  it("returns nothing for an empty catalog", () => {
    expect(selectLeadSellers([])).toEqual([]);
  });

  it("backfills when the catalog is missing curated lead sellers", () => {
    // No fig/apple/serviceberry/mulberry in stock at all.
    const catalog = [
      product(1, { name: "Pawpaw", slug: "pawpaw" }),
      product(2, { name: "Persimmon", slug: "persimmon" }),
    ];

    expect(selectLeadSellers(catalog).map((p) => p.id)).toEqual([1, 2]);
  });

  it("never pads the row with sold-out products", () => {
    // Only one buyable product; the rest are out of stock. A short row is
    // correct -- leading with "Sold out" cards is not.
    const catalog = [
      product(1, { name: "Pawpaw", slug: "pawpaw", available: true }),
      product(2, { name: "Persimmon", slug: "persimmon", available: false }),
      product(3, { name: "Quince", slug: "quince", available: false }),
    ];

    const chosen = selectLeadSellers(catalog);
    expect(chosen.map((p) => p.id)).toEqual([1]);
    expect(chosen.every((p) => p.available)).toBe(true);
  });

  it("prefers an in-stock match over a sold-out one for the same term", () => {
    const catalog = [
      product(1, { name: "Fig (sold out)", slug: "fig-sold-out", available: false }),
      product(2, { name: "Fig (in stock)", slug: "fig-in-stock", available: true }),
    ];

    expect(selectLeadSellers(catalog)[0].id).toBe(2);
  });

  it("breaks ties toward the Odoo-featured product", () => {
    const catalog = [
      product(1, { name: "Apple A", slug: "apple-a", featured: false }),
      product(2, { name: "Apple B", slug: "apple-b", featured: true }),
    ];

    expect(selectLeadSellers(catalog)[0].id).toBe(2);
  });

  it("does not fabricate a sale on a product whose name hits an Object prototype key", () => {
    // SALE_OVERRIDES is indexed by product-derived strings; "Constructor"
    // normalizes to `constructor`, which on a plain object literal would
    // resolve to Object.prototype.constructor and read as an override.
    const catalog = [
      product(1, { name: "Constructor", slug: "constructor" }),
      product(2, { name: "ToString", slug: "tostring" }),
      product(3, { name: "ValueOf", slug: "valueof" }),
    ];

    for (const p of selectLeadSellers(catalog)) {
      expect(p.onSale).toBe(false);
      expect(p.compareAtPrice).toBeNull();
    }
  });

  it("marks a genuinely discounted product on sale with its compare-at price", () => {
    const catalog = [
      product(1, {
        name: "Montmorency Sour Cherry",
        slug: "montmorency-sour-cherry",
        price: 42,
      }),
    ];

    const [chosen] = selectLeadSellers(catalog);
    expect(chosen.onSale).toBe(true);
    expect(chosen.compareAtPrice).toBe(58);
  });

  it("does not mark a sale when the compare-at price is not above the live price", () => {
    // Same override key, but the product already costs more than the
    // compare-at -- striking through a lower number would be misleading.
    const catalog = [
      product(1, {
        name: "Montmorency Sour Cherry",
        slug: "montmorency-sour-cherry",
        price: 58,
      }),
    ];

    expect(selectLeadSellers(catalog)[0].onSale).toBe(false);
  });
});

describe("displayPrice", () => {
  it("uses the lowest variant price when the list endpoint supplied one", () => {
    expect(displayPrice(product(1, { price: 30, priceMin: 18 }))).toBe(18);
  });

  it("falls back to the product price when priceMin is absent (mocks, detail fetches)", () => {
    expect(displayPrice(product(1, { price: 30 }))).toBe(30);
  });
});
