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

  it("returns null for a schema-2 (box-keyed) feed so a tier caller keeps its snapshot", async () => {
    // A box-keyed table would make resolveRateTable() price every green state to
    // null (no `bareroot`/`potted` key); the legacy accessor must decline it.
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(SCHEMA2_FEED), { status: 200 }),
    );

    await expect(createOdooClient(config).shipping.rates()).resolves.toBeNull();
  });
});

// Faithful mirror of grove_headless `models/shipping_zones.py::rate_feed()` after
// Box Engine v2 (grove-odoo-modules #60): box-keyed rates from
// `data/shipping_rates.json`, plus the `packing` catalog from `shipping_boxes.py`
// BOXES. Kept verbatim so this test doubles as the parity contract for GOL-1038.
const SCHEMA2_FEED = {
  schema: 2,
  zones: {
    zone_1: { small: { base: 22 }, large: { base: 36 } },
    zone_2: { small: { base: 22 }, large: { base: 36 } },
    zone_3: { small: { base: 22 }, large: { base: 36 } },
    zone_4: { small: { base: 47 }, large: { base: 54 } },
    zone_5: { small: { base: 41 }, large: { base: 52 } },
  },
  zone_by_state: {
    WV: "zone_1", VA: "zone_1", KY: "zone_1", NC: "zone_1", DE: "zone_1",
    MD: "zone_2", PA: "zone_2", OH: "zone_2", IN: "zone_2", NJ: "zone_2", NY: "zone_2",
    IL: "zone_3", MI: "zone_3", CT: "zone_3", RI: "zone_3",
    WI: "zone_4", MN: "zone_4", MA: "zone_4", VT: "zone_4", NH: "zone_4",
    ME: "zone_5",
  },
  green_states: [
    "CT", "DE", "IL", "IN", "KY", "MA", "MD", "ME", "MI", "MN", "NC",
    "NH", "NJ", "NY", "OH", "PA", "RI", "VA", "VT", "WI", "WV",
  ],
  packing: {
    boxes: {
      small: { length: 24, width: 6, height: 4, capacity: { dormant: 5, leafed: 5 } },
      large: { length: 24, width: 9, height: 6, capacity: { dormant: 10, leafed: 10 } },
    },
    length_classes: [16, 20],
    modes: ["dormant", "leafed"],
  },
  calendar: {
    preorder_open: { fall: [8, 15], spring: [11, 1] },
    leafed_window: [[5, 6], [8, 14]],
    fulfillment_days: [5, 10],
    zones: {
      "2": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "3": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "4": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "5": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "6": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "7": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "8": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "9": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
      "10": { fall: [[9, 15], [10, 30]], spring: [[1, 1], [5, 5]] },
    },
  },
};

describe("client.shipping.rateFeed (schema-2 Box Engine v2 feed, GOL-1038)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("GETs the rate feed and returns the full typed schema-2 payload verbatim (parity)", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify(SCHEMA2_FEED), { status: 200 }));

    const feed = await createOdooClient(config).shipping.rateFeed();

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:8069/grove/api/v1/shipping/rates",
    );
    // Parity contract: the client mirrors rate_feed() exactly, no field dropped.
    expect(feed).toEqual(SCHEMA2_FEED);
    // Box-keyed rates (not tier-keyed) and the packing catalog survive typed.
    expect(feed?.zones.zone_5?.large?.base).toBe(52);
    expect(feed?.packing.boxes.small?.capacity.dormant).toBe(5);
    expect(feed?.packing.length_classes).toEqual([16, 20]);
    expect(feed?.zone_by_state.ME).toBe("zone_5");
    expect(feed?.green_states).toHaveLength(21);
  });

  it("requests the same daily-ish revalidate as the legacy accessor", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify(SCHEMA2_FEED), { status: 200 }));

    await createOdooClient(config).shipping.rateFeed();

    const init = mockFetch.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(init.next?.revalidate).toBeGreaterThan(0);
  });

  it("returns null for a legacy schema-1 feed (Odoo not yet upgraded to Box Engine v2)", async () => {
    // Schema-1 payload has no `schema` and no `packing` → not a box feed.
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(FEED), { status: 200 }));

    await expect(createOdooClient(config).shipping.rateFeed()).resolves.toBeNull();
  });

  it("returns null for a schema-2 feed missing its packing block", async () => {
    const { packing: _packing, ...noPacking } = SCHEMA2_FEED;
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(noPacking), { status: 200 }));

    await expect(createOdooClient(config).shipping.rateFeed()).resolves.toBeNull();
  });

  it("returns null when the schema-2 zones table is empty (not configured)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ...SCHEMA2_FEED, zones: {} }), { status: 200 }),
    );

    await expect(createOdooClient(config).shipping.rateFeed()).resolves.toBeNull();
  });

  it("returns null when the feed is unreachable so the caller keeps its snapshot", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("boom", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(createOdooClient(config).shipping.rateFeed()).resolves.toBeNull();
  });
});
