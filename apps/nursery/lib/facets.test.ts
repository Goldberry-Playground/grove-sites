import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  parseFacetParams,
  applyTagFilter,
  applySearchFilter,
  buildTagFacet,
  shopHref,
  ZONE_OPTIONS,
  type FacetParams,
} from "./facets";

function product(
  id: number,
  tags: string[],
  extra: Partial<Pick<Product, "name" | "categoryName">> = {},
): Product {
  return {
    id,
    slug: `p-${id}`,
    name: extra.name ?? `Product ${id}`,
    sku: null,
    description: null,
    seoDescription: null,
    price: 10,
    currency: "USD",
    imageUrl: "",
    categoryId: null,
    categoryName: extra.categoryName ?? null,
    tags,
    available: true,
    featured: false,
    variants: [],
  };
}

const FACETS = (over: Partial<FacetParams> = {}): FacetParams => ({
  cat: null,
  zone: null,
  tags: [],
  layer: null,
  sun: null,
  q: null,
  ...over,
});

describe("parseFacetParams", () => {
  it("reads cat, a valid zone, and repeated + comma tags", () => {
    expect(parseFacetParams({ cat: "apple", zone: "5", tag: ["nitrogen-fixer", "edible"] })).toEqual({
      cat: "apple",
      zone: 5,
      tags: ["nitrogen-fixer", "edible"],
      layer: null,
      sun: null,
      q: null,
    });
    expect(parseFacetParams({ tag: "a,b" }).tags).toEqual(["a", "b"]);
  });

  it("reads and trims a search query, dropping a blank one to null", () => {
    expect(parseFacetParams({ q: "  Fig  " }).q).toBe("Fig");
    expect(parseFacetParams({ q: "   " }).q).toBeNull();
    expect(parseFacetParams({ q: "" }).q).toBeNull();
    expect(parseFacetParams({}).q).toBeNull();
  });

  it("drops a zone outside the supported set or non-numeric", () => {
    expect(parseFacetParams({ zone: "12" }).zone).toBeNull();
    expect(parseFacetParams({ zone: "abc" }).zone).toBeNull();
  });

  it("reads valid layer + sun values", () => {
    expect(parseFacetParams({ layer: "vine", sun: "partial" })).toMatchObject({
      layer: "vine",
      sun: "partial",
    });
  });

  it("drops a layer or sun value outside the supported set", () => {
    expect(parseFacetParams({ layer: "canopy-ish" }).layer).toBeNull();
    expect(parseFacetParams({ sun: "dappled" }).sun).toBeNull();
    // takes the first value when the param repeats
    expect(parseFacetParams({ layer: ["shrub", "vine"] }).layer).toBe("shrub");
  });

  it("defaults everything when params are absent", () => {
    expect(parseFacetParams({})).toEqual({
      cat: null,
      zone: null,
      tags: [],
      layer: null,
      sun: null,
      q: null,
    });
  });

  it("covers the documented zone range", () => {
    expect(ZONE_OPTIONS).toContain(3);
    expect(ZONE_OPTIONS).toContain(9);
  });
});

describe("applyTagFilter", () => {
  const products = [
    product(1, ["apple", "edible"]),
    product(2, ["apple", "nitrogen-fixer"]),
    product(3, ["pear", "edible"]),
  ];

  it("is a no-op with no selected tags", () => {
    expect(applyTagFilter(products, [])).toHaveLength(3);
  });

  it("AND-combines multiple tags", () => {
    expect(applyTagFilter(products, ["apple", "edible"]).map((p) => p.id)).toEqual([1]);
  });

  it("returns empty when no product carries all selected tags", () => {
    expect(applyTagFilter(products, ["apple", "pear"])).toEqual([]);
  });

  it("tolerates products with no tags", () => {
    expect(applyTagFilter([product(9, [])], ["apple"])).toEqual([]);
  });
});

describe("applySearchFilter", () => {
  const products = [
    product(1, [], { name: "Fig", categoryName: "Fruit Tree" }),
    product(2, [], { name: "Honeycrisp Apple", categoryName: "Fruit Tree" }),
    product(3, [], { name: "Black Walnut", categoryName: "Nut Tree" }),
    product(4, [], { name: "Aronia", categoryName: "Fruit & Nut Shrubs" }),
  ];

  it("is a no-op for a null or blank query", () => {
    expect(applySearchFilter(products, null)).toHaveLength(4);
    expect(applySearchFilter(products, "   ")).toHaveLength(4);
  });

  it("matches product name, case-insensitively", () => {
    expect(applySearchFilter(products, "fig").map((p) => p.id)).toEqual([1]);
    expect(applySearchFilter(products, "APPLE").map((p) => p.id)).toEqual([2]);
  });

  it("matches the category name so a type search narrows the grid", () => {
    expect(applySearchFilter(products, "nut tree").map((p) => p.id)).toEqual([3]);
    expect(applySearchFilter(products, "fruit tree").map((p) => p.id)).toEqual([1, 2]);
  });

  it("returns empty on no match (drives the search empty state)", () => {
    expect(applySearchFilter(products, "banana")).toEqual([]);
  });
});

describe("shopHref (filter-param merge)", () => {
  it("returns bare /shop for an empty selection", () => {
    expect(shopHref(FACETS())).toBe("/shop");
  });

  it("preserves other facets when patching one axis", () => {
    const current = FACETS({ zone: 5, tags: ["edible"], sun: "full" });
    // Picking a category keeps zone/tag/sun (the merge this ticket is about).
    expect(shopHref(current, { cat: "fruit-trees" })).toBe(
      "/shop?cat=fruit-trees&zone=5&tag=edible&sun=full",
    );
  });

  it("clears an axis with null while keeping the rest", () => {
    const current = FACETS({ cat: "fruit-trees", zone: 5, q: "fig" });
    expect(shopHref(current, { cat: null })).toBe("/shop?zone=5&q=fig");
  });

  it("emits repeated tags and keeps a stable key order (SSR-safe)", () => {
    const current = FACETS({ cat: "x", tags: ["a", "b"], layer: "shrub" });
    expect(shopHref(current)).toBe("/shop?cat=x&tag=a&tag=b&layer=shrub");
  });
});

describe("buildTagFacet", () => {
  const products = [
    product(1, ["apple", "edible"]),
    product(2, ["apple", "nitrogen-fixer"]),
    product(3, ["edible"]),
  ];

  it("counts tags and ranks by count then name", () => {
    const facet = buildTagFacet(products, []);
    expect(facet.map((o) => [o.value, o.count])).toEqual([
      ["apple", 2],
      ["edible", 2],
      ["nitrogen-fixer", 1],
    ]);
  });

  it("marks active tags and keeps a selected tag with zero current count", () => {
    const facet = buildTagFacet(products, ["apple", "rare"]);
    expect(facet.find((o) => o.value === "apple")?.active).toBe(true);
    const rare = facet.find((o) => o.value === "rare");
    expect(rare).toEqual({ value: "rare", count: 0, active: true });
  });
});
