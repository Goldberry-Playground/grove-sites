import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOdooClient, OdooApiError } from "./client";

const config = { tenantId: "nursery", odooUrl: "http://localhost:8069" };

describe("client.planner.catalog (order-builder feed, GOL-3383)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("GETs /grove/api/v1/planner/catalog with the feed's 5-minute revalidate and returns it as-is", async () => {
    const feed = { states: ["WV"], state_zones: { WV: [5, 7] }, plants: [], bundles: [] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(feed), { status: 200 }));

    const result = await createOdooClient(config).planner.catalog();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8069/grove/api/v1/planner/catalog");
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(300);
    expect(result).toEqual(feed);
  });

  it("returns null on a backend that predates the route (404)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not found", { status: 404 }));
    await expect(createOdooClient(config).planner.catalog()).resolves.toBeNull();
  });

  it("re-throws anything that is not a 404", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 502 }));
    await expect(createOdooClient(config).planner.catalog()).rejects.toBeInstanceOf(OdooApiError);
  });
});

describe("client.planner tester routes (winter-beta §C.4, GOL-3551)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("POSTs a dispute with the tester token in the body, never cached", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const body = { tester_token: "t".repeat(32), product_tmpl_id: 5, fact: "zone_min" as const };
    await createOdooClient(config).planner.dispute(body);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8069/grove/api/v1/planner/dispute");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it("testerStatus reads the dispute route's token check: 400 valid, 403 invalid, 503/404 off", async () => {
    const client = createOdooClient(config);
    for (const [status, want] of [[400, "valid"], [403, "invalid"], [503, "off"], [404, "off"]] as const) {
      vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status }));
      await expect(client.planner.testerStatus("t".repeat(32))).resolves.toBe(want);
    }
    // The probe carries the token and nothing else, so Odoo can write nothing.
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ tester_token: "t".repeat(32) });
  });

  it("testerStatus re-throws a 5xx", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 502 }));
    await expect(createOdooClient(config).planner.testerStatus("t".repeat(32))).rejects.toBeInstanceOf(OdooApiError);
  });
});
