import { describe, expect, it, vi } from "vitest";
import { OdooApiError, type OdooClient, type Product } from "@grove/odoo-client";
import {
  createCartTiersRoute,
  createPromoPreviewRoute,
  PROMO_PREVIEW_UNAVAILABLE,
} from "./createPromoRoutes";

const ORIGIN = "https://atthegrovenursery.com";

function post(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const preview = {
  ok: true,
  applied: "code" as const,
  code: "FLATWOODS",
  discountAmount: 10,
  subtotalAfter: 50,
  message: "FLATWOODS applied",
  tier: null,
};

describe("POST /api/checkout/promo (createPromoPreviewRoute)", () => {
  it("forwards the cart + trimmed code and returns the backend preview", async () => {
    const promoPreview = vi.fn(async () => preview);
    const odoo = { checkout: { promoPreview } } as unknown as OdooClient;
    const { POST } = createPromoPreviewRoute(odoo, { allowedOrigins: [ORIGIN] });
    const res = await POST(
      post("/api/checkout/promo", {
        items: [{ variantId: 51, quantity: 2 }],
        fulfillment: "ship",
        promoCode: " FLATWOODS ",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(preview);
    expect(promoPreview).toHaveBeenCalledWith({
      items: [{ variantId: 51, quantity: 2 }],
      fulfillment: "ship",
      promoCode: "FLATWOODS",
    });
  });

  it("relays a backend refusal verbatim (deposit carts get no code)", async () => {
    const refusal = "Promo codes apply to orders that ship now. Your cart is a reservation.";
    const odoo = {
      checkout: {
        promoPreview: vi.fn(async () => {
          throw new OdooApiError(400, "Odoo API error: 400", JSON.stringify({ error: refusal }));
        }),
      },
    } as unknown as OdooClient;
    const { POST } = createPromoPreviewRoute(odoo, { allowedOrigins: [ORIGIN] });
    const res = await POST(post("/api/checkout/promo", { items: [{ variantId: 196, quantity: 1 }], promoCode: "FLATWOODS" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: refusal });
  });

  it("says the code will be checked at payment when the backend predates the route", async () => {
    const odoo = {
      checkout: {
        promoPreview: vi.fn(async () => {
          throw new OdooApiError(404, "Odoo API error: 404", "<html>Not Found</html>");
        }),
      },
    } as unknown as OdooClient;
    const { POST } = createPromoPreviewRoute(odoo, { allowedOrigins: [ORIGIN] });
    const res = await POST(post("/api/checkout/promo", { items: [{ variantId: 51, quantity: 1 }], promoCode: "X" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: PROMO_PREVIEW_UNAVAILABLE });
  });

  it("rejects a foreign origin, a missing cart and an oversized code before calling Odoo", async () => {
    const promoPreview = vi.fn();
    const odoo = { checkout: { promoPreview } } as unknown as OdooClient;
    const { POST } = createPromoPreviewRoute(odoo, { allowedOrigins: [ORIGIN] });
    const foreign = new Request(`${ORIGIN}/api/checkout/promo`, {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    expect((await POST(foreign)).status).toBe(403);
    expect((await POST(post("/api/checkout/promo", { items: [] }))).status).toBe(400);
    expect(
      (await POST(post("/api/checkout/promo", { items: [{ variantId: 1, quantity: 1 }], promoCode: "X".repeat(65) }))).status,
    ).toBe(400);
    expect(promoPreview).not.toHaveBeenCalled();
  });
});

// Catalog fixtures: `treeCount` per variant — 1 per plant, 5 for the
// Remembrance Grove bundle, 0 for supplies.
function product(id: number, variants: { id: number; treeCount?: number | null }[]): Product {
  return { id, variants } as unknown as Product;
}
const CATALOG: Record<number, Product> = {
  5: product(5, [{ id: 51, treeCount: 1 }]), // pear
  30: product(30, [{ id: 301, treeCount: 5 }]), // Remembrance Grove bundle
  40: product(40, [{ id: 401, treeCount: 0 }]), // tree guard (supply)
  50: product(50, [{ id: 501, treeCount: null }]), // payload predates tree_count
};
const TIERS = [
  { minQty: 5, percent: 10, label: "10% off 5+ trees" },
  { minQty: 10, percent: 20, label: "20% off 10+ trees" },
];

function tiersOdoo(tiers = TIERS) {
  const get = vi.fn(async (id: number) => CATALOG[id]);
  const auto = vi.fn(async () => tiers);
  return { odoo: { products: { get }, promotions: { auto } } as unknown as OdooClient, get };
}

describe("POST /api/cart/tiers (createCartTiersRoute)", () => {
  it.each([
    // [pears, bundles, supplies] → qualifying units
    [4, 0, 3, 4],
    [0, 1, 2, 5],
    [4, 1, 0, 9],
    [0, 2, 1, 10],
  ])("%i pears + %i bundles + %i supplies → %i qualifying trees", async (pears, bundles, supplies, units) => {
    const { odoo } = tiersOdoo();
    const { POST } = createCartTiersRoute(odoo, { allowedOrigins: [ORIGIN] });
    const items = [
      pears && { variantId: 51, templateId: 5, quantity: pears },
      bundles && { variantId: 301, templateId: 30, quantity: bundles },
      supplies && { variantId: 401, templateId: 40, quantity: supplies },
    ].filter(Boolean);
    const res = await POST(post("/api/cart/tiers", { items }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tiers: TIERS, qualifyingUnits: units });
  });

  it("returns a null count (no nudge) when any line's tree count is unknown", async () => {
    const { odoo } = tiersOdoo();
    const { POST } = createCartTiersRoute(odoo, { allowedOrigins: [ORIGIN] });
    const res = await POST(
      post("/api/cart/tiers", {
        items: [
          { variantId: 51, templateId: 5, quantity: 4 },
          { variantId: 501, templateId: 50, quantity: 1 },
        ],
      }),
    );
    expect(await res.json()).toEqual({ tiers: TIERS, qualifyingUnits: null });
  });

  it("skips the catalog entirely when no automatic program is live", async () => {
    const { odoo, get } = tiersOdoo([]);
    const { POST } = createCartTiersRoute(odoo, { allowedOrigins: [ORIGIN] });
    const res = await POST(post("/api/cart/tiers", { items: [{ variantId: 51, templateId: 5, quantity: 4 }] }));
    expect(await res.json()).toEqual({ tiers: [], qualifyingUnits: null });
    expect(get).not.toHaveBeenCalled();
  });
});
