import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOdooClient } from "./client";

const config = { tenantId: "nursery", odooUrl: "http://localhost:8069" };

const FEED = {
  zones: {
    zone_1: { bareroot: { base: 21 }, potted: { base: 32 } },
    zone_2: { bareroot: { base: 22 }, potted: { base: 34 } },
  },
  zone_by_state: { WV: "zone_1", MD: "zone_2" },
  green_states: ["MD", "WV"],
};

describe("client.shipping.rates (live shipping-rate feed, GOL-969)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("GETs /grove/api/v1/shipping/rates and returns the zones map (RateTable shape)", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify(FEED), { status: 200 }));

    const client = createOdooClient(config);
    const table = await client.shipping.rates();

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:8069/grove/api/v1/shipping/rates",
    );
    // Only the `zones` map is surfaced — exactly the estimator's RateTable shape.
    expect(table).toEqual(FEED.zones);
    expect(table?.zone_1?.potted?.base).toBe(32);
  });

  it("requests a daily-ish revalidate so product views don't re-hit Odoo each render", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify(FEED), { status: 200 }));

    await createOdooClient(config).shipping.rates();

    const init = mockFetch.mock.calls[0][1] as (RequestInit & {
      next?: { revalidate?: number };
    });
    expect(init.next?.revalidate).toBeGreaterThan(0);
  });

  it("returns null (→ estimator falls back to snapshot) when the feed is unreachable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("boom", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(createOdooClient(config).shipping.rates()).resolves.toBeNull();
  });

  it("returns null when the feed is empty rather than pricing everything to null", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ zones: {}, zone_by_state: {}, green_states: [] }),
        { status: 200 },
      ),
    );

    await expect(createOdooClient(config).shipping.rates()).resolves.toBeNull();
  });
});
