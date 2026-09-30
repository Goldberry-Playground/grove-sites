import { describe, it, expect } from "vitest";
import type { CatalogNav, CatalogNavNode, Product } from "@grove/odoo-client";
import {
  visibleDepartments,
  findDepartment,
  departmentHref,
  showsFacet,
  facetListLabel,
  waitlistInterest,
  isGuildProduct,
  guildPurpose,
  ORCHARD_SLUG,
} from "./departments";

/**
 * Department nav rules (GOL-2745, spec § Testing — "nav rendering from
 * /catalog/nav (live, coming_soon, hidden, live-with-zero-products hidden);
 * facet allowlist per department").
 */

function dept(over: Partial<CatalogNavNode> & { slug: string }): CatalogNavNode {
  return {
    name: over.slug,
    kind: "department",
    status: "live",
    teaser: null,
    facets: [],
    comingList: [],
    categories: [],
    count: 0,
    ...over,
  };
}

const NAV = (departments: CatalogNavNode[], guilds: CatalogNavNode | null = null): CatalogNav => ({
  departments,
  guilds,
});

describe("visibleDepartments", () => {
  it("shows a live department that has products", () => {
    const nav = NAV([dept({ slug: "orchard", count: 12 }), dept({ slug: "myco", count: 3 })]);
    expect(visibleDepartments(nav).map((d) => d.slug)).toEqual(["orchard", "myco"]);
  });

  it("hides a live department with zero products", () => {
    // Spec rule: live AND >=1 published product. A live-but-empty tab is a dead
    // end the shopper spends a tap discovering.
    const nav = NAV([dept({ slug: "orchard", count: 12 }), dept({ slug: "myco", count: 0 })]);
    expect(visibleDepartments(nav).map((d) => d.slug)).toEqual(["orchard"]);
  });

  it("shows a coming-soon department even with zero products", () => {
    // The whole point of a teaser: no products, still visible.
    const nav = NAV([
      dept({ slug: "orchard", count: 12 }),
      dept({ slug: "forest-farming", status: "coming_soon", count: 0 }),
    ]);
    expect(visibleDepartments(nav).map((d) => d.slug)).toEqual(["orchard", "forest-farming"]);
  });

  it("never shows a hidden department", () => {
    const nav = NAV([
      dept({ slug: "orchard", count: 12 }),
      dept({ slug: "retired", status: "hidden", count: 40 }),
    ]);
    expect(visibleDepartments(nav).map((d) => d.slug)).toEqual(["orchard"]);
  });

  it("keeps Orchard on the bar at a zero count", () => {
    // Orchard IS /shop. Suppressing it would leave a shopper standing in a
    // department with no way back to it.
    const nav = NAV([dept({ slug: ORCHARD_SLUG, count: 0 })]);
    expect(visibleDepartments(nav).map((d) => d.slug)).toEqual([ORCHARD_SLUG]);
  });
});

describe("findDepartment", () => {
  const nav = NAV([
    dept({ slug: ORCHARD_SLUG, count: 5 }),
    dept({ slug: "myco", status: "coming_soon" }),
    dept({ slug: "retired", status: "hidden", count: 9 }),
  ]);

  it("resolves a visible department", () => {
    expect(findDepartment(nav, "myco")?.slug).toBe("myco");
  });

  it("returns null for a hidden slug, so the route 404s", () => {
    expect(findDepartment(nav, "retired")).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(findDepartment(nav, "nope")).toBeNull();
  });
});

describe("departmentHref", () => {
  it("keeps Orchard at /shop, not /shop/orchard", () => {
    // /shop/orchard would 404 and split the department's SEO across two URLs.
    expect(departmentHref(ORCHARD_SLUG)).toBe("/shop");
  });

  it("gives every other department its own page", () => {
    expect(departmentHref("seed-and-scion")).toBe("/shop/seed-and-scion");
  });
});

describe("showsFacet", () => {
  it("limits a department to its declared facets", () => {
    const myco = dept({ slug: "myco", facets: ["zone", "fungus", "host_tree"] });
    expect(showsFacet(myco, "zone")).toBe(true);
    expect(showsFacet(myco, "fungus")).toBe(true);
    // Sun and layer describe orchard stock, not inoculated host trees.
    expect(showsFacet(myco, "sun")).toBe(false);
    expect(showsFacet(myco, "layer")).toBe(false);
  });

  it("falls back to the orchard set when a department declares none", () => {
    // A backend without `grove_facets` must not silently strip the shop's
    // existing filters.
    const bare = dept({ slug: "orchard" });
    expect(showsFacet(bare, "zone")).toBe(true);
    expect(showsFacet(bare, "layer")).toBe(true);
    expect(showsFacet(bare, "sun")).toBe(true);
    expect(showsFacet(null, "zone")).toBe(true);
    // Still bounded: a facet outside the default set stays off.
    expect(showsFacet(null, "fungus")).toBe(false);
  });
});

describe("facetListLabel", () => {
  it("renders an and-joined list for the teaser note", () => {
    expect(facetListLabel(["zone", "host_tree", "fungus"])).toBe(
      "Hardiness zone, Host tree and Fungus",
    );
    expect(facetListLabel(["form", "species"])).toBe("Form and Species");
    expect(facetListLabel(["ships"])).toBe("Ships to");
    expect(facetListLabel([])).toBe("");
  });
});

describe("waitlistInterest", () => {
  it("builds the spec's interest tag", () => {
    expect(waitlistInterest("mycoforestry")).toBe("waitlist:mycoforestry");
  });
});

function product(over: Partial<Product> & { id: number }): Product {
  return {
    slug: `p${over.id}`,
    name: `Product ${over.id}`,
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

describe("isGuildProduct", () => {
  it("matches the nav's own collection slug", () => {
    const p = product({ id: 1, categories: [{ id: 6, name: "Guilds", slug: "guilds" }] });
    expect(isGuildProduct(p, "guilds")).toBe(true);
  });

  it("still matches the pre-restructure category slug", () => {
    // The spec's Phase-1 fallback: ship Guilds from category 6 via today's API
    // if the Odoo restructure slips.
    const p = product({
      id: 2,
      categories: [{ id: 6, name: "Food Forest Packages", slug: "food-forest-packages" }],
    });
    expect(isGuildProduct(p, "guilds")).toBe(true);
  });

  it("does not match an ordinary plant", () => {
    const p = product({
      id: 3,
      categories: [{ id: 1, name: "Fruit Trees", slug: "fruit-trees" }],
    });
    expect(isGuildProduct(p, "guilds")).toBe(false);
  });
});

describe("guildPurpose", () => {
  it("takes the first sentence of the guild's own copy", () => {
    expect(
      guildPurpose(
        "<p>2 pears, 2 persimmons, and 1 eastern redbud for pollination. $80 for the bundle.</p>",
      ),
    ).toBe("2 pears, 2 persimmons, and 1 eastern redbud for pollination.");
  });

  it("decodes entities and collapses whitespace", () => {
    expect(guildPurpose("<p>Pears &amp;\n  plums   for a hedge.</p>")).toBe(
      "Pears & plums for a hedge.",
    );
  });

  it("returns the whole text when there is only one sentence", () => {
    expect(guildPurpose("<p>A native Appalachian mix.</p>")).toBe("A native Appalachian mix.");
  });

  it("returns null for empty or missing copy", () => {
    expect(guildPurpose(null)).toBeNull();
    expect(guildPurpose("<p></p>")).toBeNull();
    expect(guildPurpose(undefined)).toBeNull();
  });

  it("truncates rather than paraphrases a very long sentence", () => {
    // The copy is Josh's and Sora's; a card is not the place to rewrite it.
    const long = `<p>${"word ".repeat(80)}end</p>`;
    const out = guildPurpose(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBeLessThanOrEqual(180);
    expect(out!.endsWith("…")).toBe(true);
  });
});
