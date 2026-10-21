import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiPlannerCatalog, OdooClient, Product } from "@grove/odoo-client";
import {
  enrichWithVariants,
  loadPlannerCatalog,
  pickPlannerVariant,
  resetPlannerCatalogMemo,
} from "./planner-catalog";

const feed: ApiPlannerCatalog = {
  states: ["WV"],
  state_zones: { WV: [5, 7] },
  plants: [
    {
      id: 4, slug: "american-persimmon", name: "American Persimmon", botanical_name: "Diospyros virginiana",
      genus: "diospyros", price: 12, tier: "bareroot", pickup_only: false, in_stock: true,
      preorder_cap_reached: false, layer: "understory", zone_min: 6, zone_max: 9, years_to_fruit_min: 3,
      pollination_min: 1, harvest_months: [9, 10, 11], tolerates: { wet: true, poor_soil: true, shade: false },
      wildlife_value: "high", priority: 50, blocked_states: ["CA"], substitute_id: null, image: null,
    },
  ],
  bundles: [
    { id: 132, slug: "mountain-mama", name: "Mountain Mama", price: 50, component_ids: [4, 4], consult_built: false },
  ],
};

function detail(id: number, variants: Product["variants"]): Product {
  return { id, slug: "x", name: "x", sku: null, description: null, seoDescription: null, price: 0, currency: null,
    imageUrl: "", categoryId: null, categoryName: null, available: true, featured: false, variants };
}

function fakeOdoo(overrides: Partial<{ catalog: () => Promise<ApiPlannerCatalog | null>; get: (id: number) => Promise<Product> }> = {}) {
  const get = vi.fn(overrides.get ?? (async (id: number) => detail(id, [
    { id: id * 10 + 1, name: "Potted", sku: null, price: 20, available: true, imageUrl: "", shippingTier: "potted" },
    { id: id * 10 + 2, name: "Bareroot", sku: null, price: 12, available: true, imageUrl: "", shippingTier: "bareroot" },
  ])));
  const catalog = vi.fn(overrides.catalog ?? (async () => feed));
  const rateFeed = vi.fn(async () => ({ calendar: { zones: {}, fulfillment_days: [5, 10] } }));
  return { odoo: { products: { get }, planner: { catalog }, shipping: { rateFeed } } as unknown as OdooClient, get, catalog };
}

beforeEach(() => resetPlannerCatalogMemo());

describe("pickPlannerVariant", () => {
  const v = (id: number, tier: "bareroot" | "potted", available = true) =>
    ({ id, name: tier, sku: null, price: 1, available, imageUrl: "", shippingTier: tier });
  it("prefers the plant's tier in stock, then that tier, then anything", () => {
    expect(pickPlannerVariant([v(1, "potted"), v(2, "bareroot", false), v(3, "bareroot")], "bareroot")?.id).toBe(3);
    expect(pickPlannerVariant([v(1, "potted"), v(2, "bareroot", false)], "bareroot")?.id).toBe(2);
    expect(pickPlannerVariant([v(1, "potted")], "bareroot")?.id).toBe(1);
    expect(pickPlannerVariant([], "bareroot")).toBeNull();
  });
});

describe("enrichWithVariants", () => {
  it("resolves the cart variant id (and its price) for plants and bundles", async () => {
    const { odoo } = fakeOdoo();
    const out = await enrichWithVariants(odoo, feed);
    expect(out.plants[0]).toMatchObject({ variant_id: 42, price: 12 });
    expect(out.bundles[0]).toMatchObject({ variant_id: 1321, price: 20 });
  });

  it("leaves variant_id null when the detail fetch fails, keeping the feed price", async () => {
    const { odoo } = fakeOdoo({ get: async () => { throw new Error("boom"); } });
    const out = await enrichWithVariants(odoo, feed);
    expect(out.plants[0]).toMatchObject({ variant_id: null, price: 12 });
  });

  it("skips rows the feed already resolved", async () => {
    const { odoo, get } = fakeOdoo();
    await enrichWithVariants(odoo, { ...feed, plants: [{ ...feed.plants[0], variant_id: 7 }], bundles: [] });
    expect(get).not.toHaveBeenCalled();
  });
});

describe("loadPlannerCatalog", () => {
  it("serves the enriched Odoo feed with the calendar, memoised for the TTL", async () => {
    const { odoo, catalog } = fakeOdoo();
    let t = 0;
    const now = () => t;
    const a = await loadPlannerCatalog(odoo, { allowFixture: false, now });
    expect(a?.source).toBe("odoo");
    expect(a?.calendar).toMatchObject({ fulfillment_days: [5, 10] });
    t = 60_000;
    await loadPlannerCatalog(odoo, { allowFixture: false, now });
    expect(catalog).toHaveBeenCalledTimes(1);
    t = 400_000;
    await loadPlannerCatalog(odoo, { allowFixture: false, now });
    expect(catalog).toHaveBeenCalledTimes(2);
  });

  it("falls back to the fixture outside production and to null in production", async () => {
    const { odoo } = fakeOdoo({ catalog: async () => null });
    const dev = await loadPlannerCatalog(odoo, { allowFixture: true });
    expect(dev?.source).toBe("fixture");
    expect(dev?.plants.length).toBeGreaterThan(10);
    resetPlannerCatalogMemo();
    expect(await loadPlannerCatalog(odoo, { allowFixture: false })).toBeNull();
  });

  it("treats a thrown feed like a missing one", async () => {
    const { odoo } = fakeOdoo({ catalog: async () => { throw new Error("502"); } });
    expect(await loadPlannerCatalog(odoo, { allowFixture: false })).toBeNull();
  });
});
