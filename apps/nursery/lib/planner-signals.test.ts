import { describe, expect, it, vi } from "vitest";
import type { PlanInput } from "@grove/planner";
import { BROWSER_ID_KEY, browserId, postSave, postSignal, postSuggest, signalBody, zoneBand } from "./planner-signals";

const input: PlanInput = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" };
const ctx = { input, planUrl: "https://nursery.test/plan?zip=26501", catalogVersion: 3 };

function memStorage(seed: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  };
}

describe("planner signals (spec §B.2 / §C.1)", () => {
  it("mints one browser id and keeps it", () => {
    const s = memStorage();
    const a = browserId(s);
    expect(a).toMatch(/^[A-Za-z0-9]{8,64}$/);
    expect(browserId(s)).toBe(a);
    expect(s.getItem(BROWSER_ID_KEY)).toBe(a);
    // A tampered value is replaced.
    s.setItem(BROWSER_ID_KEY, "<script>");
    expect(browserId(s)).not.toBe("<script>");
  });

  it("buckets the zone into the three beta bands", () => {
    expect(zoneBand(3)).toBe("3-5");
    expect(zoneBand(6)).toBe("6-7");
    expect(zoneBand(9)).toBe("8-9");
    expect(zoneBand(10)).toBeNull();
    expect(signalBody("removed", { ...ctx, input: { ...input, zone: { band: [5, 7] } } }, 101, "id1").zone_band).toBe("3-5");
  });

  it("carries the answers, the plan URL and the catalog version, and no personal data", () => {
    const body = signalBody("swapped", ctx, 104, "id1");
    expect(body).toEqual({
      kind: "swapped", browser_id: "id1", product_tmpl_id: 104, zone: 6, zone_band: "6-7",
      track: "food", site: "open", timing: "mixed", plan_url: ctx.planUrl, catalog_version: 3,
    });
    expect(Object.keys(body)).not.toContain("email");
  });

  it("postSignal never throws and reports whether the BFF accepted it", async () => {
    const ok = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await postSignal("built", ctx, null, ok)).toBe(true);
    expect(ok).toHaveBeenCalledTimes(1);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/planner/signal");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toMatchObject({ kind: "built", product_tmpl_id: null });
    const off = vi.fn(async () => new Response("{}", { status: 503 }));
    expect(await postSignal("built", ctx, null, off)).toBe(false);
    const down = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    expect(await postSignal("built", ctx, null, down)).toBe(false);
  });

  it("postSave and postSuggest map the BFF statuses to reasons", async () => {
    const mk = (status: number, body = "{}") => vi.fn(async () => new Response(body, { status }));
    const save = { name: "Back field", lines: [{ product_tmpl_id: 101, qty: 4 }], zone: 6, track: "food", plan_url: ctx.planUrl };
    expect(await postSave(save, mk(200, '{"ok":true,"id":7}'))).toEqual({ ok: true, id: 7 });
    expect(await postSave(save, mk(503))).toEqual({ ok: false, reason: "off" });
    expect(await postSave(save, mk(429))).toEqual({ ok: false, reason: "limit" });
    expect(await postSave(save, mk(400))).toEqual({ ok: false, reason: "invalid" });
    expect(await postSave(save, mk(502))).toEqual({ ok: false, reason: "failed" });
    const suggest = { name: "Che", stratum: "understory" as const, note: "Fruits in zone 6 for me" };
    expect(await postSuggest(suggest, mk(200))).toEqual({ ok: true, id: null });
    const f = mk(200);
    await postSuggest({ ...suggest, company: "" }, f);
    expect(JSON.parse(((f.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string)).toMatchObject({ name: "Che", browser_id: expect.any(String) });
  });
});
