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
