import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  parseFacetParams,
  applyTagFilter,
  buildTagFacet,
  ZONE_OPTIONS,
} from "./facets";

function product(id: number, tags: string[]): Product {
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
    });
    expect(parseFacetParams({ tag: "a,b" }).tags).toEqual(["a", "b"]);
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
    expect(parseFacetParams({})).toEqual({ cat: null, zone: null, tags: [], layer: null, sun: null });
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
