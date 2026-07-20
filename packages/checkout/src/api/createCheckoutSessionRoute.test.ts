import { describe, it, expect, vi } from "vitest";
import type { OdooClient, CheckoutSession } from "@grove/odoo-client";
import { createCheckoutSessionRoute } from "./createCheckoutRoute";

const ALLOWED = [
  "https://atthegrovenursery.com",
  "http://localhost:3001",
] as const;

const FAKE_SESSION: CheckoutSession = {
  sessionId: "cs_test_123",
  checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
  orderId: 42,
  orderRef: "SO0042",
  accessToken: "tok_fake",
  hasPreorder: false,
  amountDueToday: 43.7,
  amountTotal: 43.7,
  currency: "USD",
};

/** Minimal OdooClient stub — only checkout.createSession is exercised here. */
function makeOdoo(session: CheckoutSession | Error = FAKE_SESSION): OdooClient {
  const createSession =
    session instanceof Error
      ? vi.fn().mockRejectedValue(session)
      : vi.fn().mockResolvedValue(session);
  return {
    health: vi.fn(),
    products: { list: vi.fn(), get: vi.fn(), getBySlug: vi.fn() },
    cart: { get: vi.fn(), addItem: vi.fn() },
    orders: { create: vi.fn(), get: vi.fn() },
    checkout: { createSession },
  } as unknown as OdooClient;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    contact: { name: "Pat Customer", email: "pat@example.com" },
    shipping: {
      street: "123 Main St",
      city: "Asheville",
      state: "NC",
      zip: "28801",
      country: "USA",
    },
    items: [{ variantId: 7, quantity: 2 }],
    successUrl: "https://atthegrovenursery.com/checkout/success",
    cancelUrl: "https://atthegrovenursery.com/checkout/cancel",
    ...overrides,
  };
}

function postReq(body: unknown, origin: string = ALLOWED[0]): Request {
  return new Request("https://example.test/api/checkout/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("createCheckoutSessionRoute", () => {
  it("creates a session and returns it for a valid payload", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutSessionRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAKE_SESSION);
    expect(odoo.checkout.createSession).toHaveBeenCalledTimes(1);
  });

  it("rejects a cross-origin request before any backend work", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutSessionRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload(), "https://evil.example"));

    expect(res.status).toBe(403);
    expect(odoo.checkout.createSession).not.toHaveBeenCalled();
  });

  it("still enforces the shared order validation (bad email)", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutSessionRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ contact: { name: "Pat", email: "nope" } })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact\.email/);
    expect(odoo.checkout.createSession).not.toHaveBeenCalled();
  });

  it("rejects a missing successUrl", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutSessionRoute(odoo, { allowedOrigins: ALLOWED });

    const payload = validPayload() as Record<string, unknown>;
    delete payload.successUrl;
    const res = await handler(postReq(payload));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/successUrl/);
    expect(odoo.checkout.createSession).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) cancelUrl", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutSessionRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ cancelUrl: "javascript:alert(1)" })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cancelUrl/);
    expect(odoo.checkout.createSession).not.toHaveBeenCalled();
  });

  it("sanitizes an upstream error into a safe response", async () => {
    const odoo = makeOdoo(new Error("stripe boom with secret sk_live_x"));
    const handler = createCheckoutSessionRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload()));

    expect(res.status).toBeGreaterThanOrEqual(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("sk_live_x");
  });
});
