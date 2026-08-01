import { afterEach, describe, expect, it, vi } from "vitest";
import { OdooApiError } from "@grove/odoo-client";
import { forwardCheckoutError, sanitizeUpstreamError } from "./upstreamError";

/** Build an OdooApiError the way the client does: status + composed message +
 *  raw body. */
function odooError(status: number, body: string): OdooApiError {
  return new OdooApiError(status, `Odoo API error: ${status} … — ${body}`, body);
}

describe("forwardCheckoutError", () => {
  it("relays a 400 stock/potted rejection with the backend's friendly message", async () => {
    const res = forwardCheckoutError(
      odooError(
        400,
        JSON.stringify({
          error:
            "Potted trees are available for farm pickup only — remove them from the cart to ship.",
        }),
      ),
    );

    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    expect((await res!.json()).error).toContain("Potted trees are available");
  });

  it("relays a 409 shipping-gap breaker at the same status", async () => {
    const res = forwardCheckoutError(
      odooError(409, JSON.stringify({ error: "We couldn't calculate shipping." })),
    );

    expect(res!.status).toBe(409);
    expect((await res!.json()).error).toBe("We couldn't calculate shipping.");
  });

  it("relays 404 / 503 (variant gone / not configured)", () => {
    expect(forwardCheckoutError(odooError(404, '{"error":"Product variant(s) not found: [9]"}'))!.status).toBe(404);
    expect(forwardCheckoutError(odooError(503, '{"error":"Checkout is not configured yet"}'))!.status).toBe(503);
  });

  it("does NOT forward a 5xx — those carry tracebacks and stay generic", () => {
    expect(
      forwardCheckoutError(odooError(500, "Traceback (most recent call last): …")),
    ).toBeNull();
  });

  it("does not forward a non-OdooApiError (plain Error / network)", () => {
    expect(forwardCheckoutError(new Error("boom"))).toBeNull();
    expect(forwardCheckoutError("weird string throw")).toBeNull();
  });

  it("falls back to null when the body is not JSON (e.g. an HTML error page)", () => {
    expect(forwardCheckoutError(odooError(400, "<html>Bad Request</html>"))).toBeNull();
  });

  it("falls back to null when the JSON body has no string `error`", () => {
    expect(forwardCheckoutError(odooError(400, '{"detail":"nope"}'))).toBeNull();
    expect(forwardCheckoutError(odooError(400, '{"error":""}'))).toBeNull();
    expect(forwardCheckoutError(odooError(400, '{"error":123}'))).toBeNull();
  });
});

describe("sanitizeUpstreamError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a 502 response with a generic message — never the upstream body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mimics the OdooClient: status + body baked into the error message.
    const upstream = new Error(
      "Odoo API error: 500 Internal Server Error — Traceback (most recent call last):\n  File \"/odoo/addons/sale.py\" line 42, …",
    );

    const response = sanitizeUpstreamError(upstream, "checkout/create-order");
    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body).toEqual({
      error: "Service temporarily unavailable. Please try again.",
    });
    // Defense-in-depth: assert the upstream noise never reached the wire.
    expect(JSON.stringify(body)).not.toContain("Traceback");
    expect(JSON.stringify(body)).not.toContain("/odoo/addons");
    expect(JSON.stringify(body)).not.toContain("Odoo API error");
  });

  it("logs the raw error server-side so operators can still debug", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const upstream = new Error("Odoo API error: 500 — internal table schema X");

    sanitizeUpstreamError(upstream, "cart/add-item");

    expect(spy).toHaveBeenCalledTimes(1);
    const [logMessage, loggedError] = spy.mock.calls[0];
    expect(logMessage).toContain("cart/add-item");
    expect(loggedError).toBe(upstream);
  });

  it("handles non-Error throws (objects, strings) without crashing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = sanitizeUpstreamError({ weird: "shape" }, "checkout/x");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Service temporarily unavailable. Please try again.",
    });
  });
});
