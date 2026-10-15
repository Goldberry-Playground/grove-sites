import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOdooClient } from "./client";

const config = { baseUrl: "https://odoo.test", apiKey: "k" } as never;

function lastBody(): Record<string, unknown> {
  const call = vi.mocked(fetch).mock.calls.at(-1)!;
  return JSON.parse((call[1] as RequestInit).body as string);
}

const baseOrder = {
  contact: { name: "A", email: "a@b.co" },
  shipping: {},
  paymentMethod: "card",
  items: [{ variantId: 1, quantity: 1 }],
} as never;

describe("ship_wave pass-through", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
  });

  it("checkout.createSession posts ship_wave", async () => {
    const c = createOdooClient(config);
    await c.checkout
      .createSession({ ...(baseOrder as object), shipWave: "spring", successUrl: "s", cancelUrl: "c" } as never)
      .catch(() => undefined);
    expect(lastBody().ship_wave).toBe("spring");
  });

  it("orders.create posts ship_wave", async () => {
    const c = createOdooClient(config);
    await c.orders.create({ ...(baseOrder as object), shipWave: "fall" } as never).catch(() => undefined);
    expect(lastBody().ship_wave).toBe("fall");
  });

  it("checkout.quote posts ship_wave (null by default)", async () => {
    const c = createOdooClient(config);
    await c.checkout.quote({ items: [{ variantId: 1, quantity: 1 }], shipWave: "spring" }).catch(() => undefined);
    expect(lastBody().ship_wave).toBe("spring");
    await c.checkout.quote({ items: [{ variantId: 1, quantity: 1 }] }).catch(() => undefined);
    expect(lastBody().ship_wave).toBeNull();
  });

  it("checkout.quote posts the destination ZIP as shipping.zip only once known (GOL-3194)", async () => {
    const c = createOdooClient(config);
    await c.checkout.quote({ items: [{ variantId: 1, quantity: 1 }], shipWave: "fall", zip: "55401" }).catch(() => undefined);
    expect(lastBody().shipping).toEqual({ zip: "55401" });
    await c.checkout.quote({ items: [{ variantId: 1, quantity: 1 }], shipWave: "fall" }).catch(() => undefined);
    expect("shipping" in lastBody()).toBe(false);
  });
});

describe("checkout.quote shipping state (GOL-3315 Printify live quote)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
  });

  it("sends shipping state and zip together", async () => {
    const c = createOdooClient(config);
    await c.checkout
      .quote({ items: [{ variantId: 1, quantity: 1 }], fulfillment: "ship", zip: "90001", state: "CA" })
      .catch(() => undefined);
    expect(lastBody().shipping).toEqual({ zip: "90001", state: "CA" });
  });

  it("sends state alone when the ZIP is not known yet, and nothing when neither is", async () => {
    const c = createOdooClient(config);
    await c.checkout.quote({ items: [{ variantId: 1, quantity: 1 }], state: "CA" }).catch(() => undefined);
    expect(lastBody().shipping).toEqual({ state: "CA" });
    await c.checkout.quote({ items: [{ variantId: 1, quantity: 1 }] }).catch(() => undefined);
    expect("shipping" in lastBody()).toBe(false);
  });
});

describe("capture → Odoo (2026-10-15 hotfix: leads + back-in-stock)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).endsWith("/leads")
          ? new Response(JSON.stringify({ lead_id: 41, partner_id: 7, created: true }), { status: 200 })
          : new Response(JSON.stringify({ partner_id: 7, variant_ids: [3, 4] }), { status: 200 }),
      ),
    );
  });

  it("capture.lead posts the snake_case body and normalizes the result", async () => {
    const c = createOdooClient(config);
    const out = await c.capture.lead({
      email: "a@b.co",
      kind: "food_forest_consult",
      name: "Ada",
      message: "Half acre, south slope",
      productId: 134,
      source: "nursery pdp",
    });
    const call = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(String(call[0]).endsWith("/grove/api/v1/leads")).toBe(true);
    expect(lastBody()).toEqual({
      email: "a@b.co",
      kind: "food_forest_consult",
      name: "Ada",
      message: "Half acre, south slope",
      product_id: 134,
      source: "nursery pdp",
    });
    expect(out).toEqual({ leadId: 41, created: true });
  });

  it("capture.restock posts to the template route with an optional variant", async () => {
    const c = createOdooClient(config);
    const out = await c.capture.restock(93, { email: "a@b.co", variantId: 4 });
    const call = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(String(call[0]).endsWith("/grove/api/v1/products/93/notify-restock")).toBe(true);
    expect(lastBody()).toEqual({ email: "a@b.co", variant_id: 4 });
    expect(out).toEqual({ variantIds: [3, 4] });
  });
});
