import { describe, it, expect, vi } from "vitest";
import type { OdooClient, OrderSummary } from "@grove/odoo-client";
import { OdooApiError } from "@grove/odoo-client";
import { createCheckoutRoute } from "./createCheckoutRoute";

const ALLOWED = [
  "https://goldberrygrove.farm",
  "http://localhost:3001",
] as const;

const FAKE_ORDER: OrderSummary = {
  id: 42,
  name: "SO0042",
  state: "draft",
  accessToken: "tok_fake",
  amountUntaxed: 100,
  amountTax: 0,
  amountTotal: 100,
  currency: "USD",
  lineCount: 1,
};

/** Minimal OdooClient stub — only orders.create is exercised in these tests. */
function makeOdoo(overrides?: Partial<OdooClient["orders"]>): OdooClient {
  return {
    health: vi.fn(),
    products: { list: vi.fn(), get: vi.fn() },
    cart: { get: vi.fn(), addItem: vi.fn() },
    orders: {
      create: vi.fn().mockResolvedValue(FAKE_ORDER),
      get: vi.fn(),
      ...overrides,
    },
  } as unknown as OdooClient;
}

function validShipping() {
  return {
    street: "123 Main St",
    city: "Asheville",
    state: "NC",
    zip: "28801",
    country: "USA",
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    contact: { name: "Pat Customer", email: "pat@example.com" },
    shipping: validShipping(),
    items: [{ variantId: 7, quantity: 2 }],
    ...overrides,
  };
}

function postReq(body: unknown, origin: string = ALLOWED[0]): Request {
  return new Request("https://example.test/api/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify(body),
  });
}

describe("createCheckoutRoute payload validation", () => {
  it("accepts a fully valid payload and returns the created order", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(FAKE_ORDER);
    expect(odoo.orders.create).toHaveBeenCalledTimes(1);
  });

  it("rejects when contact.email is missing", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ contact: { name: "Pat" } })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact\.name and contact\.email/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects email without an @ sign", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(
        validPayload({ contact: { name: "Pat", email: "not-an-email" } }),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact\.email/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects email over MAX_EMAIL (254) chars", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    // 250-char local part + "@example.com" = 262 chars total, > 254.
    const longEmail = `${"a".repeat(250)}@example.com`;
    const res = await handler(
      postReq(validPayload({ contact: { name: "Pat", email: longEmail } })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact\.email/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects name over MAX_NAME (200) chars", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const longName = "x".repeat(201);
    const res = await handler(
      postReq(
        validPayload({ contact: { name: longName, email: "p@example.com" } }),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact\.name/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects phone over MAX_PHONE (30) chars", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(
        validPayload({
          contact: {
            name: "Pat",
            email: "p@example.com",
            phone: "1".repeat(31),
          },
        }),
      ),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contact\.phone/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects when shipping.street is missing", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const shipping = validShipping() as Record<string, unknown>;
    delete shipping.street;
    const res = await handler(postReq(validPayload({ shipping })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shipping\.street/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects shipping.zip over MAX_ZIP (20) chars", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const shipping = { ...validShipping(), zip: "0".repeat(21) };
    const res = await handler(postReq(validPayload({ shipping })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shipping\.zip/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects when shipping is missing entirely", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const payload = validPayload() as Record<string, unknown>;
    delete payload.shipping;
    const res = await handler(postReq(payload));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shipping/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  // GOL-1308: farm pickup hides the shipping fieldset in grove-ui, so the
  // browser posts an empty-string address (or none). The BFF must not require
  // a shipping address for fulfillment "pickup" — Odoo treats it as optional
  // and pickup is WV-taxed regardless of address.
  it("accepts a pickup order whose shipping fields are all empty strings", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    // Mirrors grove-ui CheckoutPage state when isPickup: address unmounted,
    // shipping left at its empty-string initial values.
    const shipping = {
      street: "",
      street2: "",
      city: "",
      state: "",
      zip: "",
      country: "US",
    };
    const res = await handler(
      postReq(validPayload({ shipping, fulfillment: "pickup" })),
    );

    expect(res.status).toBe(200);
    expect(odoo.orders.create).toHaveBeenCalledTimes(1);
  });

  it("accepts a pickup order with the shipping key omitted entirely", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const payload = validPayload({ fulfillment: "pickup" }) as Record<
      string,
      unknown
    >;
    delete payload.shipping;
    const res = await handler(postReq(payload));

    expect(res.status).toBe(200);
    expect(odoo.orders.create).toHaveBeenCalledTimes(1);
  });

  it("still requires a shipping address for an explicit ship order", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const payload = validPayload({ fulfillment: "ship" }) as Record<
      string,
      unknown
    >;
    delete payload.shipping;
    const res = await handler(postReq(payload));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shipping/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown fulfillment value", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ fulfillment: "teleport" })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/fulfillment/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects billing when present with a too-long field", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const billing = { ...validShipping(), city: "C".repeat(101) };
    const res = await handler(postReq(validPayload({ billing })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/billing\.city/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("accepts a valid billing address alongside shipping", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ billing: validShipping() })),
    );

    expect(res.status).toBe(200);
    expect(odoo.orders.create).toHaveBeenCalledTimes(1);
  });

  it("accepts and forwards a valid promoCode (GOL-2088)", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload({ promoCode: "FLATWOODS" })));

    expect(res.status).toBe(200);
    expect(odoo.orders.create).toHaveBeenCalledTimes(1);
    expect(odoo.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ promoCode: "FLATWOODS" }),
    );
  });

  it("accepts a payload with no promoCode (unchanged behavior)", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload()));

    expect(res.status).toBe(200);
    expect(odoo.orders.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ promoCode: expect.anything() }),
    );
  });

  it("rejects a promoCode over MAX_PROMO_CODE (64) chars", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ promoCode: "X".repeat(65) })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/promoCode/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects a non-string promoCode", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload({ promoCode: 12345 })));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/promoCode/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects an item with non-integer variantId (existing item validation still active)", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(
      postReq(validPayload({ items: [{ variantId: 1.5, quantity: 1 }] })),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/variantId/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  // Regression: JSON.parse("null") returns null and the original code did
  // `payload.contact?.email` which threw TypeError → unhandled 500. Now
  // returns a clean 400 before any field access.
  it("rejects a JSON `null` body with 400 instead of crashing", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(null));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JSON object/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects a JSON array body with 400", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq([{ contact: { email: "x@y.z", name: "x" } }]));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JSON object/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("rejects a JSON string body with 400", async () => {
    const odoo = makeOdoo();
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq("hello"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JSON object/);
    expect(odoo.orders.create).not.toHaveBeenCalled();
  });

  it("forwards a backend 400 unsupported-state rejection with its friendly message", async () => {
    const rejection = new OdooApiError(
      400,
      "Odoo API error: 400 Bad Request — …",
      JSON.stringify({
        error:
          "We can't ship live trees to Florida. Shipping is limited to our 21-state region for plant-health compliance — choose a supported ship-to state or farm pickup.",
      }),
    );
    const odoo = makeOdoo({ create: vi.fn().mockRejectedValue(rejection) });
    const handler = createCheckoutRoute(odoo, { allowedOrigins: ALLOWED });

    const res = await handler(postReq(validPayload()));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("21-state region");
  });
});
