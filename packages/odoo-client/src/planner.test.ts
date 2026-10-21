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
