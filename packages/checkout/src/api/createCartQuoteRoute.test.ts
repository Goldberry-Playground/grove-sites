import { describe, expect, it, vi } from "vitest";
import { OdooApiError, type OdooClient, type Product } from "@grove/odoo-client";
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

const backendQuote = {
  depositNow: true,
  depositReason: "sold-out" as const,
  depositAmount: 10,
  amountDueToday: 10,
  afterCutover: false,
  lines: [{ variantId: 196, quantity: 1, bareroot: true, soldOut: true, freeQty: 0 }],
};

// Backend predates the quote route (older modules pin) unless a test says otherwise.
const missingRoute = () => Promise.reject(new OdooApiError(404, "Odoo API error: 404", ""));

function fakeOdoo(
  get = vi.fn(async (id: number) => (id === 19 ? serviceberry : pear)),
  quote: (input: unknown) => Promise<unknown> = missingRoute,
) {
  const quoteFn = vi.fn(quote);
  return {
    odoo: { products: { get }, checkout: { quote: quoteFn } } as unknown as OdooClient,
    get,
    quote: quoteFn,
  };
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://atthegrovenursery.com/api/cart/quote", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("createCartQuoteRoute — backend-first", () => {
  it("returns the backend's authoritative quote and never reads the catalog", async () => {
    const { odoo, get, quote } = fakeOdoo(undefined, async () => backendQuote);
    const resolve = vi.fn(() => ({ depositNow: false }));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve });
    const res = await POST(
      postReq({ items: [{ variantId: 196, templateId: 19, quantity: 1 }], fulfillment: "ship" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(backendQuote);
    expect(quote).toHaveBeenCalledWith({ items: [{ variantId: 196, quantity: 1 }], fulfillment: "ship" });
    expect(get).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("falls back to the catalog estimate when the backend route is missing (404)", async () => {
    const { odoo, get } = fakeOdoo();
    const resolve = vi.fn(() => ({ depositNow: true }));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve });
    const res = await POST(postReq({ items: [{ variantId: 196, templateId: 19, quantity: 1 }] }));
    expect(await res.json()).toEqual({ depositNow: true });
    expect(get).toHaveBeenCalled();
  });

  it("falls back on any other backend failure too (a quote must never block the cart)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { odoo } = fakeOdoo(undefined, async () => { throw new Error("ECONNRESET"); });
    const resolve = vi.fn(() => ({ depositNow: false }));
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve });
    const res = await POST(postReq({ items: [{ variantId: 196, templateId: 19, quantity: 1 }] }));
    expect(res.status).toBe(200);
    expect(resolve).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("skips the backend when preferBackend is false", async () => {
    const { odoo, quote } = fakeOdoo(undefined, async () => backendQuote);
    const { POST } = createCartQuoteRoute(odoo, { allowedOrigins: [ORIGIN], resolve: () => ({ n: 1 }), preferBackend: false });
    expect(await (await POST(postReq({ items: [{ variantId: 196, templateId: 19, quantity: 1 }] }))).json()).toEqual({ n: 1 });
    expect(quote).not.toHaveBeenCalled();
  });
});

describe("createCartQuoteRoute — catalog fallback", () => {
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
