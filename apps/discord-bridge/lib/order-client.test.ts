import { describe, it, expect, vi } from "vitest";
import { orderAction, type OrderClientConfig } from "./order-client";

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

const RETRY = "Couldn't reach Odoo. Nothing changed; try again.";

describe("orderAction", () => {
  it("fails visibly (no throw) when the bridge key is missing", async () => {
    const res = await orderAction({ odooApiBase: "", odooBridgeKey: "" }, "42", "mark-shipped", { actor: "Wes" }, vi.fn());
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.error).toMatch(/not configured/i);
  });

  it("POSTs to the route with the bearer key and the body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { card: { orderId: 42 } }));
    const res = await orderAction(CFG, "42", "hold/release", { actor: "Wes" }, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://odoo.example.com/grove/api/v1/orders/42/hold/release");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    expect(JSON.parse(init.body)).toEqual({ actor: "Wes" });
    expect(res.ok).toBe(true);
    expect(res.card).toEqual({ orderId: 42 });
  });

  it("success with card: null is still ok, with a null card", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { card: null }));
    const res = await orderAction(CFG, "42", "move", { actor: "Wes", wave: "spring" }, fetchImpl);
    expect(res.ok).toBe(true);
    expect(res.card).toBeNull();
  });

  it("reports already_shipped from a mark-shipped reply", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { already_shipped: true, card: null }));
    const res = await orderAction(CFG, "42", "mark-shipped", { actor: "Wes" }, fetchImpl);
    expect(res.alreadyShipped).toBe(true);
  });

  it("422 surfaces Odoo's error text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422, { error: "Tracking number is required." }));
    const res = await orderAction(CFG, "42", "mark-shipped", { actor: "Wes" }, fetchImpl);
    expect(res).toMatchObject({ ok: false, status: 422, error: "Tracking number is required." });
  });

  it("409 surfaces Odoo's error text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(409, { error: "S00042 is on hold until Oct 15." }));
    const res = await orderAction(CFG, "42", "mark-shipped", { actor: "Wes" }, fetchImpl);
    expect(res).toMatchObject({ ok: false, status: 409, error: "S00042 is on hold until Oct 15." });
  });

  it("a non-JSON reply gives the plain retry message, never a status or body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const res = await orderAction(CFG, "42", "hold", { actor: "Wes" }, fetchImpl);
    expect(res.ok).toBe(false);
    expect(res.error).toBe(RETRY);
  });

  it("a non-2xx JSON reply without an error string gives the plain retry message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { message: "nope" }));
    const res = await orderAction(CFG, "42", "hold", { actor: "Wes" }, fetchImpl);
    expect(res.error).toBe(RETRY);
  });

  it("never throws on a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await orderAction(CFG, "42", "hold", { actor: "Wes" }, fetchImpl);
    expect(res).toMatchObject({ ok: false, status: 0, error: RETRY });
  });
});
