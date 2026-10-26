import { beforeEach, describe, expect, it, vi } from "vitest";
import { OdooApiError, type OdooClient } from "@grove/odoo-client";
import { createLeadCaptureRoute, createRestockCaptureRoute } from "./createCaptureRoutes";
import { CAPTURE_LIMIT, resetCaptureLimiter } from "./rateLimit";

const ORIGIN = "https://atthegrovenursery.com";

function post(path: string, body: unknown, origin = ORIGIN, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// The limiter store is module-global; keep each test independent.
beforeEach(() => {
  resetCaptureLimiter();
});

/** The shape the shared CaptureForm already POSTs. */
const formBody = {
  email: "ada@example.com",
  name: "Ada",
  brand: "nursery",
  source: "notify-me",
  label: "nursery-wholesale",
  interests: ["nursery"],
  multibrand: false,
  consent: true,
};

describe("POST /api/leads (createLeadCaptureRoute)", () => {
  it("turns a capture-form submit into an Odoo CRM lead, kind from the query", async () => {
    const lead = vi.fn(async (_input: unknown) => ({ leadId: 41, created: true }));
    const odoo = { capture: { lead } } as unknown as OdooClient;
    const { POST } = createLeadCaptureRoute(odoo, { allowedOrigins: [ORIGIN] });
    const res = await POST(post("/api/leads?kind=wholesale", { ...formBody, message: "200 pawpaws" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(lead).toHaveBeenCalledWith({
      email: "ada@example.com",
      kind: "wholesale",
      name: "Ada",
      message: "200 pawpaws",
      label: "nursery-wholesale",
      source: "notify-me",
    });
  });

  it("passes state and product from the query", async () => {
    const lead = vi.fn(async (_input: unknown) => ({ leadId: 1, created: true }));
    const { POST } = createLeadCaptureRoute({ capture: { lead } } as unknown as OdooClient, { allowedOrigins: [ORIGIN] });
    await POST(post("/api/leads?kind=state_waitlist&state=ca", formBody));
    expect(lead.mock.calls[0][0]).toMatchObject({ kind: "state_waitlist", state: "CA" });
    await POST(post("/api/leads?kind=food_forest_consult&product=134", formBody));
    expect(lead.mock.calls[1][0]).toMatchObject({ kind: "food_forest_consult", productId: 134 });
  });

  it("passes the department slug for the shop waitlist and requires it (GOL-3456 §8)", async () => {
    const lead = vi.fn(async (_input: unknown) => ({ leadId: 1, created: true }));
    const { POST } = createLeadCaptureRoute({ capture: { lead } } as unknown as OdooClient, { allowedOrigins: [ORIGIN] });
    const ok = await POST(post("/api/leads?kind=dept_waitlist&dept=Mycoforestry", formBody));
    expect(ok.status).toBe(200);
    expect(lead.mock.calls[0][0]).toMatchObject({ kind: "dept_waitlist", department: "mycoforestry" });
    const missing = await POST(post("/api/leads?kind=dept_waitlist", formBody));
    expect(missing.status).toBe(400);
    expect(lead).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown kind and a foreign origin without calling Odoo", async () => {
    const lead = vi.fn();
    const { POST } = createLeadCaptureRoute({ capture: { lead } } as unknown as OdooClient, { allowedOrigins: [ORIGIN] });
    expect((await POST(post("/api/leads?kind=spam", formBody))).status).toBe(400);
    expect((await POST(post("/api/leads?kind=wholesale", formBody, "https://evil.example"))).status).toBe(403);
    expect(lead).not.toHaveBeenCalled();
  });

  it("drops a honeypot (filled `company`) with a silent 200 and no Odoo call", async () => {
    const lead = vi.fn();
    const { POST } = createLeadCaptureRoute({ capture: { lead } } as unknown as OdooClient, { allowedOrigins: [ORIGIN] });
    const res = await POST(post("/api/leads?kind=wholesale", { ...formBody, company: "Acme Bots Inc" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(lead).not.toHaveBeenCalled();
  });

  it("rate-limits a flood from one client and stops hitting Odoo (429)", async () => {
    const lead = vi.fn(async (_input: unknown) => ({ leadId: 1, created: true }));
    const { POST } = createLeadCaptureRoute({ capture: { lead } } as unknown as OdooClient, { allowedOrigins: [ORIGIN] });
    const flood = () => post("/api/leads?kind=wholesale", formBody, ORIGIN, { "x-forwarded-for": "203.0.113.7" });
    for (let i = 0; i < CAPTURE_LIMIT; i++) {
      expect((await POST(flood())).status).toBe(200);
    }
    expect((await POST(flood())).status).toBe(429);
    expect(lead).toHaveBeenCalledTimes(CAPTURE_LIMIT);
  });

  it("relays a backend 400 and hides a backend outage behind a 502", async () => {
    const lead = vi
      .fn()
      .mockRejectedValueOnce(new OdooApiError(400, "Odoo API error", JSON.stringify({ error: "email is not a valid email address" })))
      .mockRejectedValueOnce(new Error("socket hang up"));
    const { POST } = createLeadCaptureRoute({ capture: { lead } } as unknown as OdooClient, { allowedOrigins: [ORIGIN] });
    expect((await POST(post("/api/leads?kind=wholesale", formBody))).status).toBe(400);
    expect((await POST(post("/api/leads?kind=wholesale", formBody))).status).toBe(502);
  });
});

describe("POST /api/notify/restock (createRestockCaptureRoute)", () => {
  it("subscribes the email to the template's back-in-stock alert", async () => {
    const restock = vi.fn(async (_id: number, _input: unknown) => ({ variantIds: [3, 4] }));
    const { POST } = createRestockCaptureRoute({ capture: { restock } } as unknown as OdooClient, {
      allowedOrigins: [ORIGIN],
    });
    const res = await POST(post("/api/notify/restock?product=93", formBody));
    expect(res.status).toBe(200);
    expect(restock).toHaveBeenCalledWith(93, { email: "ada@example.com", name: "Ada" });
  });

  it("passes a variant when given", async () => {
    const restock = vi.fn(async (_id: number, _input: unknown) => ({ variantIds: [4] }));
    const { POST } = createRestockCaptureRoute({ capture: { restock } } as unknown as OdooClient, {
      allowedOrigins: [ORIGIN],
    });
    await POST(post("/api/notify/restock?product=93&variant=4", formBody));
    expect(restock).toHaveBeenCalledWith(93, { email: "ada@example.com", name: "Ada", variantId: 4 });
  });

  it("drops a honeypot submit with a silent 200 and no Odoo call", async () => {
    const restock = vi.fn();
    const { POST } = createRestockCaptureRoute({ capture: { restock } } as unknown as OdooClient, {
      allowedOrigins: [ORIGIN],
    });
    const res = await POST(post("/api/notify/restock?product=93", { ...formBody, company: "bot" }));
    expect(res.status).toBe(200);
    expect(restock).not.toHaveBeenCalled();
  });

  it("400s without a product id and relays a backend 404", async () => {
    const restock = vi.fn().mockRejectedValueOnce(new OdooApiError(404, "Odoo API error", JSON.stringify({ error: "Product not found" })));
    const { POST } = createRestockCaptureRoute({ capture: { restock } } as unknown as OdooClient, {
      allowedOrigins: [ORIGIN],
    });
    expect((await POST(post("/api/notify/restock", formBody))).status).toBe(400);
    expect((await POST(post("/api/notify/restock?product=999", formBody))).status).toBe(404);
  });
});
