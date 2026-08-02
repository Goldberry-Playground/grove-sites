import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  parseFacetParams,
  applyTagFilter,
  applySearchFilter,
  normalizeQuery,
  buildShopHref,
  buildTagFacet,
  ZONE_OPTIONS,
} from "./facets";

function product(id: number, tags: string[], overrides: Partial<Product> = {}): Product {
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
    tags,
    available: true,
    featured: false,
    variants: [],
    ...overrides,
  };
}

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

  it("reads and trims a search query, dropping a blank one", () => {
    expect(parseFacetParams({ q: "  dwarf apple  " }).q).toBe("dwarf apple");
    expect(parseFacetParams({ q: "   " }).q).toBeNull();
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

describe("normalizeQuery", () => {
  it("trims, bounds to 80 chars, and nulls a blank query", () => {
    expect(normalizeQuery("  apple ")).toBe("apple");
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery("   ")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery("x".repeat(200))).toHaveLength(80);
  });
});

describe("applySearchFilter", () => {
  const products = [
    product(1, ["edible"], { name: "Dwarf Apple", categoryName: "Malus" }),
    product(2, ["edible"], { name: "Standard Apple", categoryName: "Malus" }),
    product(3, ["understory"], { name: "Pawpaw", categoryName: "Asimina" }),
  ];

  it("is a no-op for a blank/null query", () => {
    expect(applySearchFilter(products, null)).toHaveLength(3);
    expect(applySearchFilter(products, "  ")).toHaveLength(3);
  });

  it("matches on name, is case-insensitive", () => {
    expect(applySearchFilter(products, "pawpaw").map((p) => p.id)).toEqual([3]);
    expect(applySearchFilter(products, "APPLE").map((p) => p.id)).toEqual([1, 2]);
  });

  it("matches on botanical/category name and tags", () => {
    expect(applySearchFilter(products, "asimina").map((p) => p.id)).toEqual([3]);
    expect(applySearchFilter(products, "understory").map((p) => p.id)).toEqual([3]);
  });

  it("AND-combines whitespace-separated terms", () => {
    expect(applySearchFilter(products, "dwarf apple").map((p) => p.id)).toEqual([1]);
    expect(applySearchFilter(products, "dwarf pawpaw")).toEqual([]);
  });
});

describe("buildShopHref", () => {
  it("returns a bare /shop when nothing is set", () => {
    expect(buildShopHref({ cat: null })).toBe("/shop");
  });

  it("sets only the category when no facets are preserved", () => {
    expect(buildShopHref({ cat: "apple" })).toBe("/shop?cat=apple");
  });

  it("preserves zone/layer/sun/tag/q while swapping the category", () => {
    const href = buildShopHref(
      { cat: "apple" },
      { cat: "pear", zone: 5, layer: "vine", sun: "full", tags: ["edible"], q: "dwarf" },
    );
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("cat")).toBe("apple");
    expect(params.get("zone")).toBe("5");
    expect(params.get("layer")).toBe("vine");
    expect(params.get("sun")).toBe("full");
    expect(params.getAll("tag")).toEqual(["edible"]);
    expect(params.get("q")).toBe("dwarf");
  });

  it("clears the category (patch null) but keeps the other axes", () => {
    const href = buildShopHref({ cat: null }, { cat: "apple", zone: 6, tags: [] });
    expect(href).toBe("/shop?zone=6");
  });

  it("keeps the preserved category when the patch omits cat", () => {
    expect(buildShopHref({}, { cat: "apple", tags: [] })).toBe("/shop?cat=apple");
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
