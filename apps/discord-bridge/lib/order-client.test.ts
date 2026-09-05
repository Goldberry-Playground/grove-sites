import { describe, it, expect, vi } from "vitest";
import { markShipped, type OrderClientConfig } from "./order-client";

const CFG: OrderClientConfig = {
  odooApiBase: "https://odoo.example.com/",
  odooBridgeKey: "sk_test",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("markShipped", () => {
  it("fails visibly (no throw) when the bridge key is missing", async () => {
    const res = await markShipped({ odooApiBase: "", odooBridgeKey: "" }, "42", "1", vi.fn());
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/not configured/i);
  });

  it("POSTs to the mark-shipped endpoint with the bearer key + actor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { name: "S00042", already_shipped: false, tracking_numbers: ["1Z999"] }),
    );
    const res = await markShipped(CFG, "42", "208085380262526976", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://odoo.example.com/grove/api/v1/orders/42/mark-shipped");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    expect(JSON.parse(init.body)).toEqual({ actor: "208085380262526976" });
    expect(res.ok).toBe(true);
    expect(res.alreadyShipped).toBe(false);
    expect(res.orderRef).toBe("S00042");
    expect(res.tracking).toEqual(["1Z999"]);
  });

  it("reports already_shipped on an idempotent double-click", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { name: "S1", already_shipped: true }));
    const res = await markShipped(CFG, "42", undefined, fetchImpl);
    expect(res.ok).toBe(true);
    expect(res.alreadyShipped).toBe(true);
    // no actor → empty body, never a stray {actor: undefined}
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({});
  });

  it("surfaces a non-2xx as ok:false with the Odoo error detail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, { error: "Order not found" }));
    const res = await markShipped(CFG, "999", "1", fetchImpl);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.error).toBe("Order not found");
  });

  it("never throws on a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await markShipped(CFG, "42", "1", fetchImpl);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/ECONNREFUSED/);
  });
});
