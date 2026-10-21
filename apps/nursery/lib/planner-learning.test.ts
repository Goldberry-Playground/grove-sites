import { beforeEach, describe, expect, it, vi } from "vitest";
import { OdooApiError, type OdooClient } from "@grove/odoo-client";
import {
  LEARNING_LIMIT_PER_HOUR,
  cleanBody,
  createPlannerLearningRoute,
  overLimit,
} from "./planner-learning";

/** BFF passthroughs for the learning loop (planner-winter-beta spec §C, GOL-3550). */

const ORIGIN = "https://atthegrovenursery.com";

function client(overrides: Partial<OdooClient["planner"]> = {}) {
  const planner = {
    catalog: vi.fn(),
    signal: vi.fn(async () => ({ ok: true as const })),
    suggest: vi.fn(async () => ({ ok: true as const })),
    save: vi.fn(async () => ({ ok: true as const, id: 7 })),
    ...overrides,
  };
  return { odoo: { planner } as unknown as OdooClient, planner };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://nursery.test/api/planner/signal", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const signal = { kind: "removed", browser_id: "abc123def456", product_tmpl_id: 101, zone: 6, track: "food", site: "open", timing: "mixed", plan_url: "https://x/plan?zip=26501", catalog_version: 3 };

let store: Map<string, number[]>;
beforeEach(() => {
  store = new Map();
});

describe("createPlannerLearningRoute", () => {
  it("forwards a clean signal to Odoo and answers 200", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerLearningRoute(odoo, "signal", { allowedOrigins: [ORIGIN], store });
    const res = await POST(post(signal));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(planner.signal).toHaveBeenCalledWith({
      kind: "removed", browser_id: "abc123def456", product_tmpl_id: 101, zone: 6, zone_band: null,
      track: "food", site: "open", timing: "mixed", plan_url: "https://x/plan?zip=26501", catalog_version: 3,
    });
  });

  it("refuses an off-site Origin (403) and never calls Odoo", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerLearningRoute(odoo, "signal", { allowedOrigins: [ORIGIN], store });
    expect((await POST(post(signal, { origin: "https://evil.example" }))).status).toBe(403);
    const noOrigin = new Request("http://nursery.test/api/planner/signal", { method: "POST", body: JSON.stringify(signal) });
    expect((await POST(noOrigin)).status).toBe(403);
    expect(planner.signal).not.toHaveBeenCalled();
  });

  it("honeypot: a filled `company` field is answered 200 and dropped", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerLearningRoute(odoo, "suggest", { allowedOrigins: [ORIGIN], store });
    const res = await POST(post({ name: "Che", browser_id: "abc123def456", company: "Acme Bots" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: null });
    expect(planner.suggest).not.toHaveBeenCalled();
  });

  it("400 on malformed JSON, a bad kind, a product-less remove, or a bad save line", async () => {
    const { odoo } = client();
    const { POST } = createPlannerLearningRoute(odoo, "signal", { allowedOrigins: [ORIGIN], store });
    expect((await POST(post("{not json"))).status).toBe(400);
    expect((await POST(post({ ...signal, kind: "liked" }))).status).toBe(400);
    expect((await POST(post({ ...signal, product_tmpl_id: null }))).status).toBe(400);
    expect((await POST(post({ ...signal, browser_id: "" }))).status).toBe(400);
    const save = createPlannerLearningRoute(odoo, "save", { allowedOrigins: [ORIGIN], store }).POST;
    expect((await save(post({ name: "Back field", browser_id: "abc123def456", lines: [] }))).status).toBe(400);
    expect((await save(post({ name: "Back field", browser_id: "abc123def456", lines: [{ product_tmpl_id: 101, qty: 0 }] }))).status).toBe(400);
  });

  it("built and saved signals need no product", () => {
    expect(cleanBody("signal", { kind: "built", browser_id: "abc123def456" })).toMatchObject({ kind: "built", product_tmpl_id: null });
    expect(cleanBody("signal", { kind: "saved", browser_id: "abc123def456", zone: "6" })).toMatchObject({ zone: 6 });
    expect(cleanBody("signal", { kind: "added", browser_id: "abc123def456" })).toBeNull();
  });

  it("maps Odoo's kill switch to 503, its limit to 429, its 400 to 400, and anything else to 502", async () => {
    const fail = (status: number) => vi.fn(async () => { throw new OdooApiError(status, "x", ""); });
    for (const [status, expected] of [[503, 503], [404, 503], [429, 429], [400, 400], [500, 502]] as const) {
      const { odoo } = client({ signal: fail(status) });
      const { POST } = createPlannerLearningRoute(odoo, "signal", { allowedOrigins: [ORIGIN], store: new Map() });
      expect((await POST(post(signal))).status).toBe(expected);
    }
    const { odoo } = client({ signal: vi.fn(async () => { throw new Error("socket hang up"); }) });
    const { POST } = createPlannerLearningRoute(odoo, "signal", { allowedOrigins: [ORIGIN], store: new Map() });
    expect((await POST(post(signal))).status).toBe(502);
  });

  it("limits a browser id to 60 an hour, sliding, before Odoo sees the 61st", async () => {
    const { odoo, planner } = client();
    let t = 1_000_000;
    const { POST } = createPlannerLearningRoute(odoo, "signal", { allowedOrigins: [ORIGIN], store, now: () => t });
    for (let i = 0; i < LEARNING_LIMIT_PER_HOUR; i++) {
      expect((await POST(post(signal, { "x-forwarded-for": `10.0.0.${i % 7}` }))).status).toBe(200);
    }
    expect((await POST(post(signal, { "x-forwarded-for": "10.0.0.9" }))).status).toBe(429);
    expect(planner.signal).toHaveBeenCalledTimes(LEARNING_LIMIT_PER_HOUR);
    // Another browser id from the same IP: the IP window is shared too.
    const other = { ...signal, browser_id: "zzz999yyy888" };
    expect((await POST(post(other, { "x-forwarded-for": "10.0.0.1" }))).status).toBe(200);
    // An hour on, the window has slid.
    t += 60 * 60 * 1000 + 1;
    expect((await POST(post(signal))).status).toBe(200);
  });

  it("overLimit sweeps expired keys so the map stays bounded", () => {
    const s = new Map<string, number[]>();
    for (let i = 0; i < 5001; i++) overLimit(`k${i}`, 0, s);
    expect(s.size).toBeGreaterThan(5000);
    overLimit("late", 2 * 60 * 60 * 1000, s);
    expect(s.size).toBe(1);
  });

  it("save: forwards the lines with role and stratum and returns Odoo's id", async () => {
    const { odoo, planner } = client();
    const { POST } = createPlannerLearningRoute(odoo, "save", { allowedOrigins: [ORIGIN], store });
    const res = await POST(post({
      name: "The back field", browser_id: "abc123def456", plan_url: "https://x/plan?zip=26501", zone: 6, track: "food",
      lines: [{ product_tmpl_id: 101, qty: 4, role: "anchor", stratum: "overstory" }, { product_tmpl_id: 117, qty: 1, role: "anchor", stratum: "mushroom" }],
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 7 });
    expect(planner.save).toHaveBeenCalledWith(expect.objectContaining({
      name: "The back field", zone: 6, track: "food",
      lines: [
        { product_tmpl_id: 101, qty: 4, role: "anchor", stratum: "overstory" },
        { product_tmpl_id: 117, qty: 1, role: "anchor", stratum: "mushroom" },
      ],
    }));
  });
});
