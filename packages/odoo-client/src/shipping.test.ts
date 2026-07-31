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

// Schema-2 feed (Box Engine v2, GOL-1037/1038). Fixture mirrors the exact shape
// of grove-odoo-modules `rate_feed()` v2: box-keyed zone rates + packing rules.
const FEED_V2 = {
  schema: 2,
  zones: {
    zone_1: {
      br16: { base: 18 },
      s20: { base: 22 },
      s32: { base: 24 },
      s46: { base: 26 },
      b20: { base: 28 },
      b32: { base: 30 },
    },
    zone_2: {
      br16: { base: 19 },
      s20: { base: 23 },
      s32: { base: 25 },
      s46: { base: 27 },
      b20: { base: 29 },
      b32: { base: 31 },
    },
  },
  zone_by_state: { WV: "zone_1", MD: "zone_2" },
  green_states: ["MD", "WV"],
  packing: {
    boxes: {
      br16: { length: 16, width: 6, height: 4, capacity: { dormant: 1 } },
      s20: { length: 20, width: 8, height: 8, capacity: { dormant: 15, leafed: 4 } },
      s32: { length: 32, width: 8, height: 8, capacity: { dormant: 15, leafed: 4 } },
      s46: { length: 46, width: 8, height: 8, capacity: { dormant: 15, leafed: 4 } },
      b20: { length: 20, width: 12, height: 12, capacity: { dormant: 50 } },
      b32: { length: 32, width: 12, height: 12, capacity: { dormant: 50 } },
    },
    length_classes: [16, 20, 32, 46],
    modes: ["dormant", "leafed"],
    dormant_window: [[11, 1], [4, 15]],
  },
};

describe("client.shipping.feed (schema-2 rate feed, Box Engine v2)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("GETs /grove/api/v1/shipping/rates and returns the whole schema-2 feed", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify(FEED_V2), { status: 200 }));

    const feed = await createOdooClient(config).shipping.feed();

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:8069/grove/api/v1/shipping/rates",
    );
    // Unlike rates(), feed() surfaces the whole payload — box-keyed zones,
    // the compliance zone map, and the packing rules.
    expect(feed).toEqual(FEED_V2);
    expect(feed?.schema).toBe(2);
    // Zones are box-keyed (schema 2), not tier-keyed (schema 1).
    expect(feed?.zones.zone_1?.s20?.base).toBe(22);
    // Packing metadata lets the frontend replay pack_order.
    expect(feed?.packing.boxes.s20.capacity.leafed).toBe(4);
    expect(feed?.packing.length_classes).toEqual([16, 20, 32, 46]);
  });

  it("requests a daily-ish revalidate like rates()", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify(FEED_V2), { status: 200 }));

    await createOdooClient(config).shipping.feed();

    const init = mockFetch.mock.calls[0][1] as (RequestInit & {
      next?: { revalidate?: number };
    });
    expect(init.next?.revalidate).toBeGreaterThan(0);
  });

  it("returns null when the feed is unreachable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("boom", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(createOdooClient(config).shipping.feed()).resolves.toBeNull();
  });

  it("returns null when the feed has no zones (not-configured)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ schema: 2, zones: {}, zone_by_state: {}, green_states: [], packing: FEED_V2.packing }),
        { status: 200 },
      ),
    );

    await expect(createOdooClient(config).shipping.feed()).resolves.toBeNull();
  });
});
