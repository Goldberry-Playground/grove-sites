import { describe, it, expect } from "vitest";
import { normalizeCatalogNav } from "./normalizers";
import type { ApiCatalogNavResponse } from "./types";

/**
 * `GET /catalog/nav` normalization (GOL-2745).
 *
 * The two list-ish Odoo fields arrive as free text (`grove_facets` a Char
 * comma-list, `grove_coming_list` a Text field of `Name | detail` lines), so
 * these tests pin the parsing AND the fail-closed rules the storefront leans
 * on: an unreadable status must not advertise a department, and an unknown
 * facet key must not paint a filter control that can't run.
 */

const ORCHARD: ApiCatalogNavResponse["departments"] = [
  {
    slug: "orchard",
    name: "Orchard & food forest",
    kind: "department",
    status: "live",
    teaser: false,
    facets: "zone,layer,sun,uses,on_offer",
    coming_list: false,
    children: [
      { slug: "fruit-trees", name: "Fruit Trees", count: 9 },
      { slug: "native", name: "Native", count: 3 },
    ],
    count: 12,
  },
];

describe("normalizeCatalogNav", () => {
  it("parses a live department, its categories and its comma-list facets", () => {
    const nav = normalizeCatalogNav({ departments: ORCHARD, collections: [] });

    expect(nav.departments).toHaveLength(1);
    const dept = nav.departments[0];
    expect(dept.slug).toBe("orchard");
    expect(dept.status).toBe("live");
    expect(dept.kind).toBe("department");
    expect(dept.teaser).toBeNull();
    expect(dept.facets).toEqual(["zone", "layer", "sun", "uses", "on_offer"]);
    expect(dept.categories).toEqual([
      { slug: "fruit-trees", name: "Fruit Trees", count: 9 },
      { slug: "native", name: "Native", count: 3 },
    ]);
    expect(dept.count).toBe(12);
    expect(nav.guilds).toBeNull();
  });

  it("parses a coming-soon teaser's `Name | detail` lines", () => {
    const nav = normalizeCatalogNav({
      departments: [
        {
          slug: "forest-farming",
          name: "Forest farming",
          kind: "department",
          status: "coming_soon",
          teaser: "  Medicinal and edible woodland crops.  ",
          facets: "shade_level, years_to_harvest",
          coming_list:
            "Goldenseal | roots and rhizomes\nGinseng | stratified seed\nRamps\n\n",
          children: [],
        },
      ],
    });

    const dept = nav.departments[0];
    expect(dept.status).toBe("coming_soon");
    expect(dept.teaser).toBe("Medicinal and edible woodland crops.");
    // Whitespace around a comma-list entry is trimmed, not treated as a typo.
    expect(dept.facets).toEqual(["shade_level", "years_to_harvest"]);
    expect(dept.comingList).toEqual([
      { name: "Goldenseal", detail: "roots and rhizomes" },
      { name: "Ginseng", detail: "stratified seed" },
      // A line with no pipe is all name — the common case for a short list.
      { name: "Ramps", detail: "" },
    ]);
    // No children and no `count` → count derives from the (empty) categories.
    expect(dept.count).toBe(0);
  });

  it("drops facet keys outside the spec allowlist", () => {
    const nav = normalizeCatalogNav({
      departments: [
        {
          slug: "mycoforestry",
          name: "Mycoforestry",
          status: "coming_soon",
          // `hostTree` is a camelCase typo for the allowlisted `host_tree`, and
          // `wingspan` is not a facet at all. Rendering either would paint a
          // control the storefront has no filter for.
          facets: "fungus,hostTree,wingspan,host_tree,fungus",
        },
      ],
    });

    expect(nav.departments[0].facets).toEqual(["fungus", "host_tree"]);
  });

  it("fails closed to hidden on an unreadable status", () => {
    const nav = normalizeCatalogNav({
      departments: [{ slug: "mystery", name: "Mystery", status: "draft" }],
    });

    // Not "live" — a department whose lifecycle we can't read must not be
    // advertised on the tab row.
    expect(nav.departments[0].status).toBe("hidden");
  });

  it("accepts already-structured facets and coming lists", () => {
    const nav = normalizeCatalogNav({
      departments: [
        {
          slug: "seed-and-scion",
          name: "Seed & scion",
          status: "coming_soon",
          facets: ["form", "species"],
          coming_list: [
            { name: "Scion wood", detail: "dormant, winter-cut" },
            "Rootstock | seedling and clonal",
          ],
        },
      ],
    });

    const dept = nav.departments[0];
    expect(dept.facets).toEqual(["form", "species"]);
    expect(dept.comingList).toEqual([
      { name: "Scion wood", detail: "dormant, winter-cut" },
      { name: "Rootstock", detail: "seedling and clonal" },
    ]);
  });

  it("picks the Guilds collection out of `collections`", () => {
    const nav = normalizeCatalogNav({
      departments: ORCHARD,
      collections: [
        {
          slug: "guilds",
          name: "Guilds",
          kind: "collection",
          status: "live",
          teaser: "Plants that grow better together.",
          children: [],
          count: 5,
        },
      ],
    });

    expect(nav.guilds).not.toBeNull();
    expect(nav.guilds?.slug).toBe("guilds");
    expect(nav.guilds?.kind).toBe("collection");
    expect(nav.guilds?.count).toBe(5);
  });

  it("reads the live gom#299 shape (`categories`, `product_count`, top-level `guilds`)", () => {
    // Trimmed from prod GET /grove/api/v1/catalog/nav, 2026-10-08.
    const nav = normalizeCatalogNav({
      departments: [
        {
          slug: "orchard-food-forest",
          name: "Orchard & food forest",
          kind: "department",
          status: "live",
          teaser: "",
          facets: ["zone", "layer", "sun", "uses", "on_offer", "ships"],
          coming_list: [],
          categories: [
            { slug: "fruit-trees", name: "Fruit Trees", count: 10 },
            { slug: "fruiting-vines", name: "Fruiting Vines", count: 0 },
          ],
          product_count: 17,
        },
      ],
      guilds: { slug: "guilds", name: "Guilds", kind: "collection", teaser: "", product_count: 6 },
    });

    const [dept] = nav.departments;
    expect(dept.categories.map((c) => c.count)).toEqual([10, 0]);
    expect(dept.count).toBe(17);
    expect(dept.teaser).toBeNull();
    // No status on the collection means live, not fail-closed hidden.
    expect(nav.guilds?.status).toBe("live");
    expect(nav.guilds?.count).toBe(6);
  });

  it("drops a Guilds node whose status is unreadable", () => {
    const nav = normalizeCatalogNav({
      guilds: { slug: "guilds", name: "Guilds", status: "draft" },
    });
    expect(nav.guilds).toBeNull();
  });

  it("returns an empty tree for a backend that predates the route", () => {
    const nav = normalizeCatalogNav({});
    expect(nav.departments).toEqual([]);
    expect(nav.guilds).toBeNull();
  });
});
