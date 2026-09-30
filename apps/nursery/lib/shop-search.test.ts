import { describe, it, expect } from "vitest";
import type { CatalogNav, CatalogNavNode, Product } from "@grove/odoo-client";
import { groupSearchResults, countSearchHits } from "./shop-search";

/**
 * Grouped cross-department search (GOL-2745, spec § Testing — "search grouping"
 * and the e2e case "searching 'ginseng' returns the Forest farming group with a
 * notify-me link").
 */

function product(over: Partial<Product> & { id: number; name: string }): Product {
  return {
    slug: `p${over.id}`,
    sku: null,
    description: null,
    seoDescription: null,
    price: 10,
    currency: null,
    imageUrl: "",
    categoryId: null,
    categoryName: null,
    available: true,
    featured: false,
    variants: [],
    ...over,
  };
}

const ORCHARD: CatalogNavNode = {
  slug: "orchard",
  name: "Orchard & food forest",
  kind: "department",
  status: "live",
  teaser: null,
  facets: [],
  comingList: [],
  categories: [],
  count: 12,
};

const FOREST_FARMING: CatalogNavNode = {
  slug: "forest-farming",
  name: "Forest farming",
  kind: "department",
  status: "coming_soon",
  teaser: null,
  facets: [],
  comingList: [
    { name: "Goldenseal", detail: "roots and rhizomes" },
    { name: "American ginseng", detail: "stratified seed" },
  ],
  categories: [],
  count: 0,
};

const GUILDS: CatalogNavNode = {
  slug: "guilds",
  name: "Guilds",
  kind: "collection",
  status: "live",
  teaser: null,
  facets: [],
  comingList: [],
  categories: [],
  count: 5,
};

const NAV: CatalogNav = { departments: [ORCHARD, FOREST_FARMING], guilds: GUILDS };

describe("groupSearchResults", () => {
  it("surfaces a coming-soon family for a query it has no products for", () => {
    // The headline acceptance case: "ginseng" must find Forest farming even
    // though not one ginseng product exists.
    const groups = groupSearchResults([], NAV, "ginseng");

    expect(groups).toHaveLength(1);
    expect(groups[0].slug).toBe("forest-farming");
    expect(groups[0].status).toBe("coming_soon");
    expect(groups[0].products).toEqual([]);
    expect(groups[0].comingItems.map((i) => i.name)).toEqual(["American ginseng"]);
  });

  it("matches a coming item on its detail as well as its name", () => {
    const groups = groupSearchResults([], NAV, "rhizomes");
    expect(groups[0].comingItems.map((i) => i.name)).toEqual(["Goldenseal"]);
  });

  it("matches the whole family when the query is the department name", () => {
    const groups = groupSearchResults([], NAV, "forest farming");
    expect(groups[0].comingItems).toHaveLength(2);
  });

  it("is accent- and case-insensitive", () => {
    const nav: CatalogNav = {
      departments: [
        { ...FOREST_FARMING, comingList: [{ name: "Épinard", detail: "" }] },
      ],
      guilds: null,
    };
    expect(groupSearchResults([], nav, "EPINARD")[0].comingItems).toHaveLength(1);
  });

  it("groups live products under their own department", () => {
    const pear = product({
      id: 1,
      name: "Pear",
      department: { id: 1, name: "Orchard & food forest", slug: "orchard" },
    });
    const groups = groupSearchResults([pear], NAV, "pear");

    expect(groups.map((g) => g.slug)).toEqual(["orchard"]);
    expect(groups[0].products).toEqual([pear]);
  });

  it("puts a guild in the Guilds group ONLY, never double-counted", () => {
    // A bundle also carries a department (its lead plant's), so without the
    // pull-out a single match would be counted twice and the totals wouldn't add.
    const bundle = product({
      id: 2,
      name: "Heirloom Fruit Package",
      department: { id: 1, name: "Orchard & food forest", slug: "orchard" },
      categories: [{ id: 6, name: "Guilds", slug: "guilds" }],
    });
    const groups = groupSearchResults([bundle], NAV, "heirloom");

    expect(groups.map((g) => g.slug)).toEqual(["guilds"]);
    expect(countSearchHits(groups)).toBe(1);
  });

  it("orders departments as the tab row does, with Guilds last", () => {
    const pear = product({
      id: 1,
      name: "Pear tree",
      department: { id: 1, name: "Orchard & food forest", slug: "orchard" },
    });
    const bundle = product({
      id: 2,
      name: "Pear pair bundle",
      categories: [{ id: 6, name: "Guilds", slug: "guilds" }],
    });
    const nav: CatalogNav = {
      departments: [ORCHARD, { ...FOREST_FARMING, comingList: [{ name: "Pear root", detail: "" }] }],
      guilds: GUILDS,
    };

    expect(groupSearchResults([pear, bundle], nav, "pear").map((g) => g.slug)).toEqual([
      "orchard",
      "forest-farming",
      "guilds",
    ]);
  });

  it("drops empty groups rather than printing a heading over nothing", () => {
    expect(groupSearchResults([], NAV, "nothing-matches-this")).toEqual([]);
  });

  it("never groups under a hidden department", () => {
    const p = product({
      id: 3,
      name: "Secret",
      department: { id: 9, name: "Retired", slug: "retired" },
    });
    const nav: CatalogNav = {
      departments: [{ ...ORCHARD, slug: "retired", name: "Retired", status: "hidden" }],
      guilds: null,
    };
    expect(groupSearchResults([p], nav, "secret")).toEqual([]);
  });

  it("falls back to Orchard for a product with no department reported", () => {
    // Today every published product IS orchard stock, and an "unknown" bucket
    // would just be noise.
    const p = product({ id: 4, name: "Fig" });
    const groups = groupSearchResults([p], NAV, "fig");
    expect(groups.map((g) => g.slug)).toEqual(["orchard"]);
  });
});

describe("countSearchHits", () => {
  it("counts buyable and coming matches together", () => {
    const p = product({ id: 1, name: "Pear" });
    const groups = groupSearchResults([p], NAV, "e");
    expect(countSearchHits(groups)).toBe(
      groups.reduce((n, g) => n + g.products.length + g.comingItems.length, 0),
    );
  });
});
