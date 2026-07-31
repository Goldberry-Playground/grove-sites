import { afterEach, describe, expect, it, vi } from "vitest";
import { OdooApiError } from "@grove/odoo-client";
import { sanitizeUpstreamError } from "./upstreamError";

describe("sanitizeUpstreamError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards a shopper-safe 4xx gating message with the upstream status", async () => {
    // grove_headless rejects an unsupported ship-to state with a 400 whose body
    // is a message written for the shopper. The BFF must surface it so the UI can
    // show the real reason + pickup offer, not a blank "try again".
    const upstream = new OdooApiError(
      400,
      'Odoo API error: 400 Bad Request — {"error":"We can\'t ship live trees to FL."}',
      { error: "We can't ship live trees to FL." },
    );

    const response = sanitizeUpstreamError(upstream, "checkout/create-order");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "We can't ship live trees to FL.",
    });
  });

  it("forwards the 409 $0-shipping circuit-breaker message", async () => {
    const upstream = new OdooApiError(
      409,
      "Odoo API error: 409 Conflict — …",
      { error: "We couldn't calculate shipping for this order right now." },
    );

    const response = sanitizeUpstreamError(upstream, "checkout/create-session");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "We couldn't calculate shipping for this order right now.",
    });
  });

  it("masks a 5xx OdooApiError even though it is a typed upstream error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const upstream = new OdooApiError(
      500,
      "Odoo API error: 500 — Traceback",
      { error: "Traceback (most recent call last)" },
    );

    const response = sanitizeUpstreamError(upstream, "checkout/create-order");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Service temporarily unavailable. Please try again.",
    });
  });

  it("masks a 4xx whose body is not a plain { error: string }", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Non-JSON body → OdooApiError.body is undefined → nothing safe to forward.
    const upstream = new OdooApiError(
      400,
      "Odoo API error: 400 Bad Request — <html>Bad Request</html>",
      undefined,
    );

    const response = sanitizeUpstreamError(upstream, "checkout/x");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Service temporarily unavailable. Please try again.",
    });
  });

  it("masks a 401/403 gating body — operator problem, not shopper-actionable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const upstream = new OdooApiError(403, "Odoo API error: 403 — …", {
      error: "access_token is required",
    });

    const response = sanitizeUpstreamError(upstream, "checkout/x");
    expect(response.status).toBe(502);
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
