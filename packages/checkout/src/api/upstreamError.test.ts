import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeUpstreamError } from "./upstreamError";

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
