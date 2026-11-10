import { describe, it, expect, vi } from "vitest";
import { MARK_ALL_TIMEOUT_MS, markBatchShipped, orderAction, type OrderClientConfig } from "./order-client";

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

  it("a non-JSON reply says Odoo may still be working, never that nothing changed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const res = await orderAction(CFG, "42", "hold", { actor: "Wes" }, fetchImpl);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/may still be working/);
    expect(res.error).not.toMatch(/Nothing changed/);
    expect(res.error).not.toMatch(/502|html/);
  });

  it("reports how many boxes a refunded label cleared", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { card: null, boxes_cleared: 2 }));
    const res = await orderAction(CFG, "42", "label-refunded", { actor: "Wes" }, fetchImpl);
    expect(res.boxesCleared).toBe(2);
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

describe("markBatchShipped", () => {
  const UNSURE = /Odoo may still be working, check the orders before retrying/;

  it("POSTs the actor to the batch route with the bearer key and a long timeout", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { shipped: 12, already: 2, skipped: [{ order: "S1", reason: "no label recorded" }] }));
    const res = await markBatchShipped(CFG, "7", "Wes", fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://odoo.example.com/grove/api/v1/label-batches/7/mark-shipped");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    expect(JSON.parse(init.body)).toEqual({ actor: "Wes" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(res).toEqual({ ok: true, status: 200, shipped: 12, already: 2, skipped: [{ order: "S1", reason: "no label recorded" }] });
  });

  it("allows at least two minutes for a batch of emails", () => {
    expect(MARK_ALL_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000);
  });

  it("fails visibly when the bridge key is missing", async () => {
    const res = await markBatchShipped({ odooApiBase: "", odooBridgeKey: "" }, "7", "Wes", vi.fn());
    expect(res).toMatchObject({ ok: false, status: 0 });
    expect(res.error).toMatch(/not configured/i);
  });

  it("a 409 is a refusal carrying Odoo's words", async () => {
    const error = "Zone 6 spring shipping starts April 5, 2027. Today is April 1, 2027, so nothing was marked shipped.";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(409, { error }));
    expect(await markBatchShipped(CFG, "7", "Wes", fetchImpl)).toEqual({ ok: false, status: 409, refused: true, error });
  });

  it("a timeout says Odoo may still be working, never 'nothing changed'", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    const res = await markBatchShipped(CFG, "7", "Wes", fetchImpl, 5);
    expect(res.ok).toBe(false);
    expect(res.refused).toBeUndefined();
    expect(res.error).toMatch(UNSURE);
    expect(res.error).not.toMatch(/nothing changed/i);
  });

  it("a real timeout aborts the request", async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
    );
    const res = await markBatchShipped(CFG, "7", "Wes", fetchImpl as unknown as typeof fetch, 20);
    expect(res.error).toMatch(UNSURE);
  });

  it("a network error, a non-JSON reply and a malformed success all say it may still be working", async () => {
    const down = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    expect((await markBatchShipped(CFG, "7", "Wes", down)).error).toMatch(UNSURE);
    const html = vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    expect((await markBatchShipped(CFG, "7", "Wes", html)).error).toMatch(UNSURE);
    const odd = vi.fn().mockResolvedValue(jsonResponse(200, { shipped: "many" }));
    expect((await markBatchShipped(CFG, "7", "Wes", odd)).error).toMatch(UNSURE);
  });

  it("a 500 passes Odoo's check-first message through", async () => {
    const error = "Something went wrong. Some orders may have shipped; check the orders before retrying.";
    const res = await markBatchShipped(CFG, "7", "Wes", vi.fn().mockResolvedValue(jsonResponse(500, { error })));
    expect(res).toMatchObject({ ok: false, status: 500, error });
    expect(res.refused).toBeUndefined();
  });
});
