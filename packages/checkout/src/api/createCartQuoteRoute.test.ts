import { describe, expect, it, vi } from "vitest";
import type { OdooClient, Product } from "@grove/odoo-client";
import { createCartQuoteRoute, type CartQuoteLine } from "./createCartQuoteRoute";

const ORIGIN = "https://atthegrovenursery.com";

function product(id: number, variants: Product["variants"]): Product {
  return { id, variants } as unknown as Product;
}

const serviceberry = product(19, [
  { id: 195, name: "Service Berry (Seedling, Potted)", sku: null, price: 12, available: false, imageUrl: "", format: "Potted", shippingTier: "potted", qtyAvailable: 0 },
  { id: 196, name: "Service Berry (Seedling, Bareroot)", sku: null, price: 12, available: false, imageUrl: "", format: "Bareroot", shippingTier: "bareroot", qtyAvailable: 0 },
]);
const pear = product(5, [
  { id: 51, name: "Pear (Bartlett, Bareroot)", sku: null, price: 30, available: true, imageUrl: "", format: "Bareroot", shippingTier: "bareroot", qtyAvailable: 12 },
]);

function fakeOdoo(get = vi.fn(async (id: number) => (id === 19 ? serviceberry : pear))) {
  return { odoo: { products: { get } } as unknown as OdooClient, get };
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://atthegrovenursery.com/api/cart/quote", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("createCartQuoteRoute", () => {
  it("enriches every line with live stock + tier and hands them to the brand rule", async () => {
    const { odoo, get } = fakeOdoo();
    const resolve = vi.fn((lines: CartQuoteLine[]) => ({ depositNow: lines.some((l) => l.qtyAvailable === 0) }));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve });

    const res = await POST(
      postReq({
        items: [
          { variantId: 196, templateId: 19, quantity: 1 },
          { variantId: 51, templateId: 5, quantity: 2 },
        ],
        fulfillment: "ship",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ depositNow: true });
    expect(resolve).toHaveBeenCalledWith(
      [
        { variantId: 196, templateId: 19, quantity: 1, shippingTier: "bareroot", format: "Bareroot", qtyAvailable: 0, available: false },
        { variantId: 51, templateId: 5, quantity: 2, shippingTier: "bareroot", format: "Bareroot", qtyAvailable: 12, available: true },
      ],
      { fulfillment: "ship" },
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("reads each template once even when several lines share it", async () => {
    const { odoo, get } = fakeOdoo();
    const resolve = vi.fn((_lines: CartQuoteLine[], _ctx: { fulfillment: "ship" | "pickup" | null }) => ({}));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve });
    await POST(
      postReq({
        items: [
          { variantId: 195, templateId: 19, quantity: 1 },
          { variantId: 196, templateId: 19, quantity: 3 },
        ],
      }),
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0][1]).toEqual({ fulfillment: null });
  });

  it("drops a line whose variant is no longer on its template instead of guessing", async () => {
    const { odoo } = fakeOdoo();
    const resolve = vi.fn((lines: CartQuoteLine[]) => ({ n: lines.length }));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve });
    const res = await POST(
      postReq({ items: [{ variantId: 999, templateId: 19, quantity: 1 }, { variantId: 196, templateId: 19, quantity: 1 }] }),
    );
    expect(await res.json()).toEqual({ n: 1 });
  });

  it("rejects a disallowed origin (403) and a non-JSON content type (415)", async () => {
    const { odoo } = fakeOdoo();
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve: () => ({}) });
    expect((await POST(postReq({ items: [] }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(postReq({ items: [] }, { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("rejects malformed bodies with 400 before touching Odoo", async () => {
    const { odoo, get } = fakeOdoo();
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve: () => ({}) });
    expect((await POST(postReq("{not json"))).status).toBe(400);
    expect((await POST(postReq({ items: [] }))).status).toBe(400);
    expect((await POST(postReq({ items: [{ variantId: 0, templateId: 19, quantity: 1 }] }))).status).toBe(400);
    expect((await POST(postReq({ items: [{ variantId: 196, templateId: 19, quantity: 10000 }] }))).status).toBe(400);
    expect(
      (await POST(postReq({ items: [{ variantId: 196, templateId: 19, quantity: 1 }], fulfillment: "teleport" }))).status,
    ).toBe(400);
    expect(get).not.toHaveBeenCalled();
  });

  it("sanitizes an upstream catalog failure instead of leaking it", async () => {
    const { odoo } = fakeOdoo(vi.fn(async () => { throw new Error("ECONNREFUSED odoo:8069 secret"); }));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve: () => ({}) });
    const res = await POST(postReq({ items: [{ variantId: 196, templateId: 19, quantity: 1 }] }));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
