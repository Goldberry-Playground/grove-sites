import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  NURSERY_CATEGORIES,
  findCategory,
  filterByCategory,
  countByCategory,
} from "./categories";

/**
 * The /shop cat-bar browses by website category — Josh's five use-type buckets
 * carried on `Product.categories`, not by the old mock plant-type tags
 * (GOL-662). GOL-773 curated the display labels + order (Native · Fruit Tree ·
 * Nut Tree · Fruit & Nut Shrubs · Vines) while keeping the slugs stable, so the
 * `label` is now display-only and no longer mirrors the Odoo category name.
 * These tests lock the slug contract + the category-based matching.
 */

// slugify mirrors the API's `slugify(name)` (grove-odoo-modules#31/#33): lower,
// drop "&", collapse non-alphanumerics to single hyphens, trim edges. Kept local
// so the slug↔Odoo-name contract is verified rather than assumed.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The Odoo `product.public.category` names each slug is derived from. GOL-773
// decoupled the shopper-facing `label` from the slug, so the slug↔label mirror
// no longer holds — the slug must still equal `slugify(<Odoo category name>)`,
// which is what actually keeps `?cat=` URLs and API counts aligned.
const ODOO_CATEGORY_NAMES: Record<string, string> = {
  "natives-ornamentals": "Natives & Ornamentals",
  "fruit-trees": "Fruit Trees",
  "nut-trees": "Nut Trees",
  berries: "Berries",
  "fruiting-vines": "Fruiting Vines",
};

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
  product(1, ["fruit-trees"]),
  product(2, ["fruit-trees"]),
  product(3, ["berries"]),
  product(4, ["fruiting-vines"]),
  product(5, ["fruit-trees", "fruiting-vines"]), // a product can belong to more than one category
  product(6, []), // no website category — counts toward nothing
];

describe("NURSERY_CATEGORIES", () => {
  it("is Josh's five use-type buckets, in GOL-773 browse order", () => {
    expect(NURSERY_CATEGORIES.map((c) => c.slug)).toEqual([
      "natives-ornamentals",
      "fruit-trees",
      "nut-trees",
      "berries",
      "fruiting-vines",
    ]);
  });

  it("uses stable slugs that mirror slugify(<Odoo category name>)", () => {
    // GOL-773: `label` is curated display copy and is NOT expected to slugify
    // back to the slug (e.g. "Fruit & Nut Shrubs" → "berries"). The slug must
    // stay pinned to the Odoo category name so `?cat=` filtering never breaks.
    for (const c of NURSERY_CATEGORIES) {
      expect(c.slug).toBe(slugify(ODOO_CATEGORY_NAMES[c.slug]));
    }
  });
});

describe("countByCategory", () => {
  it("counts by product.categories slug, not tags", () => {
    expect(countByCategory(catalog, "fruit-trees")).toBe(3); // p1, p2, p5
    expect(countByCategory(catalog, "berries")).toBe(1); // p3
    expect(countByCategory(catalog, "fruiting-vines")).toBe(2); // p4, p5
  });

  it("returns 0 for a real category with no stock (not the old all-zero bug)", () => {
    expect(countByCategory(catalog, "nut-trees")).toBe(0);
    expect(countByCategory(catalog, "natives-ornamentals")).toBe(0);
  });

  it("never counts a product with no categories", () => {
    const total = NURSERY_CATEGORIES.reduce(
      (sum, c) => sum + countByCategory(catalog, c.slug),
      0,
    );
    // p6 (no categories) is excluded; p5 double-counts across fruit-trees + fruiting-vines.
    expect(total).toBe(6);
  });
});

describe("filterByCategory", () => {
  it("returns only products carrying that website category", () => {
    expect(filterByCategory(catalog, "berries").map((p) => p.id)).toEqual([3]);
    expect(filterByCategory(catalog, "fruiting-vines").map((p) => p.id)).toEqual([4, 5]);
  });

  it("returns the full list for an unknown or empty slug", () => {
    expect(filterByCategory(catalog, "apple")).toHaveLength(catalog.length);
    expect(filterByCategory(catalog, null)).toHaveLength(catalog.length);
  });

  it("tolerates products with a missing categories field", () => {
    const legacy = [{ ...product(9, []), categories: undefined } as Product];
    expect(filterByCategory(legacy, "fruit-trees")).toHaveLength(0);
    expect(countByCategory(legacy, "fruit-trees")).toBe(0);
  });
});

describe("findCategory", () => {
  it("resolves known slugs and rejects unknown ones", () => {
    expect(findCategory("fruit-trees")?.label).toBe("Fruit Tree");
    expect(findCategory("apple")).toBeNull();
    expect(findCategory(null)).toBeNull();
  });
});
