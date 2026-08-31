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

  it("logs a compact operator line for a 401 auth failure — never the HTML body (GOL-1888)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Odoo answers a rejected bearer key with a ~10KB HTML "4xx" page.
    const htmlBody = `<html><head><title>401 Unauthorized</title></head><body>${"x".repeat(10000)}</body></html>`;
    const upstream = odooError(401, htmlBody);

    const response = sanitizeUpstreamError(upstream, "checkout/create-session");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Service temporarily unavailable. Please try again.",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    // A single string argument — no second `error` object that would drag the
    // 10KB HTML (embedded in error.message) into the log.
    expect(spy.mock.calls[0]).toHaveLength(1);
    const [line] = spy.mock.calls[0];
    expect(line).toBe(
      "[grove-checkout] checkout/create-session AUTH FAILURE: Odoo rejected " +
        "ODOO_API_KEY (401) — bearer key invalid/revoked; checkout is DOWN until re-minted",
    );
    expect(line).not.toContain("<html>");
    expect(line).not.toContain("xxxx");
  });

  it("treats a 403 the same as a 401 (both mean the key is rejected)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    sanitizeUpstreamError(odooError(403, "<html>403 Forbidden</html>"), "cart/get");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(1);
    expect(spy.mock.calls[0][0]).toContain("AUTH FAILURE");
    expect(spy.mock.calls[0][0]).toContain("(403)");
  });

  it("does NOT treat a 401 plain Error (non-Odoo) as an auth failure — stays generic", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // A plain Error whose text mentions 401 must not trip the special-case.
    sanitizeUpstreamError(new Error("something 401 happened"), "checkout/create-order");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(2);
    expect(spy.mock.calls[0][0]).toBe("[grove-checkout] checkout/create-order upstream error:");
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
