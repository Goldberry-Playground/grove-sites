import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  NURSERY_CATEGORIES,
  findCategory,
  filterByCategory,
  countByCategory,
} from "./categories";

/**
 * The /shop cat-bar browses by website category (Trees/Shrubs/Vines) carried on
 * `Product.categories`, not by the old mock plant-type tags (GOL-658/GOL-662).
 * These tests lock the slug contract + the category-based matching.
 */

// No `as Product` here on purpose: the return-type annotation is what keeps
// this fixture honest. The cast was hiding four missing required fields
// (seoDescription / imageUrl / categoryId / categoryName) and TS2352'd the
// build. Left uncast, adding a required field to Product fails this file
// loudly instead of silently producing a half-built object at runtime.
function product(id: number, slugs: string[]): Product {
  return {
    id,
    slug: `p-${id}`,
    name: `Product ${id}`,
    sku: `SKU-${id}`,
    description: "",
    seoDescription: null,
    price: 10,
    currency: "USD",
    imageUrl: "",
    categoryId: null,
    categoryName: null,
    categories: slugs.map((slug, i) => ({ id: i + 1, name: slug, slug })),
    available: true,
    featured: false,
    variants: [],
  };
}

const catalog: Product[] = [
  product(1, ["trees"]),
  product(2, ["trees"]),
  product(3, ["shrubs"]),
  product(4, ["vines"]),
  product(5, ["trees", "vines"]), // a product can belong to more than one category
  product(6, []), // no website category — counts toward nothing
];

describe("NURSERY_CATEGORIES", () => {
  it("is the Trees → Shrubs → Vines taxonomy in nav order", () => {
    expect(NURSERY_CATEGORIES.map((c) => c.slug)).toEqual(["trees", "shrubs", "vines"]);
  });

  it("uses stable slugs that mirror slugify(<Odoo category name>)", () => {
    for (const c of NURSERY_CATEGORIES) {
      expect(c.slug).toBe(c.label.toLowerCase());
    }
  });
});

describe("countByCategory", () => {
  it("counts by product.categories slug, not tags", () => {
    expect(countByCategory(catalog, "trees")).toBe(3); // p1, p2, p5
    expect(countByCategory(catalog, "shrubs")).toBe(1); // p3
    expect(countByCategory(catalog, "vines")).toBe(2); // p4, p5
  });

  it("never counts a product with no categories", () => {
    const total =
      countByCategory(catalog, "trees") +
      countByCategory(catalog, "shrubs") +
      countByCategory(catalog, "vines");
    // p6 (no categories) is excluded; p5 double-counts across trees+vines.
    expect(total).toBe(6);
  });
});

describe("filterByCategory", () => {
  it("returns only products carrying that website category", () => {
    expect(filterByCategory(catalog, "shrubs").map((p) => p.id)).toEqual([3]);
    expect(filterByCategory(catalog, "vines").map((p) => p.id)).toEqual([4, 5]);
  });

  it("returns the full list for an unknown or empty slug", () => {
    expect(filterByCategory(catalog, "apple")).toHaveLength(catalog.length);
    expect(filterByCategory(catalog, null)).toHaveLength(catalog.length);
  });

  it("tolerates products with a missing categories field", () => {
    const legacy = [{ ...product(9, []), categories: undefined } as Product];
    expect(filterByCategory(legacy, "trees")).toHaveLength(0);
    expect(countByCategory(legacy, "trees")).toBe(0);
  });
});

describe("findCategory", () => {
  it("resolves known slugs and rejects unknown ones", () => {
    expect(findCategory("trees")?.label).toBe("Trees");
    expect(findCategory("apple")).toBeNull();
    expect(findCategory(null)).toBeNull();
  });
});
