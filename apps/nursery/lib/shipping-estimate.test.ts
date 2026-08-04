import { describe, it, expect } from "vitest";
import { SHIP_TO_STATES } from "@grove/checkout";
import type { ShippingRateFeed } from "@grove/odoo-client";
import {
  ZONE_BY_STATE,
  estimateShipping,
  estimateBoxShipping,
  estimateTierShipping,
  hasBoxFeed,
  isPickupOnly,
  shipsTo,
  tierFor,
  resolveRateTable,
  ZONE_RATE_TABLE,
} from "./shipping-estimate";

// GOL-1055 drift guard: the checkout State <select> (SHIP_TO_STATES) and the
// shipping estimator (ZONE_BY_STATE) must offer the SAME states. If they drift,
// a shopper could either be offered a state we don't price, or be priced for a
// state the checkout won't let them pick. This fails the build on divergence.
describe("checkout state select ⟷ estimator green list (GOL-1055)", () => {
  it("SHIP_TO_STATES codes exactly match the estimator's green states", () => {
    const selectCodes = SHIP_TO_STATES.map((s) => s.code).sort();
    const zoneCodes = Object.keys(ZONE_BY_STATE).sort();
    expect(selectCodes).toEqual(zoneCodes);
  });

  it("every ship-to option is a real 2-letter code with a name", () => {
    for (const s of SHIP_TO_STATES) {
      expect(s.code).toMatch(/^[A-Z]{2}$/);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });
});

describe("shipping-estimate zone map", () => {
  it("covers exactly the 21 green states", () => {
    expect(Object.keys(ZONE_BY_STATE).length).toBe(21);
  });

  it("keeps WV in the nearest zone (zone_1)", () => {
    expect(ZONE_BY_STATE.WV).toBe("zone_1");
    expect(ZONE_BY_STATE.ME).toBe("zone_5");
  });
});

describe("shipsTo", () => {
  it("true for a green state, case/space-insensitive", () => {
    expect(shipsTo("OH")).toBe(true);
    expect(shipsTo(" oh ")).toBe(true);
  });
  it("false for an ungreen state, empty, or null", () => {
    expect(shipsTo("CA")).toBe(false);
    expect(shipsTo("")).toBe(false);
    expect(shipsTo(null)).toBe(false);
  });
});

describe("tierFor", () => {
  it("prefers the server tier", () => {
    expect(tierFor({ shippingTier: "bareroot" })).toBe("bareroot");
    expect(tierFor({ shippingTier: "potted" })).toBe("potted");
  });
  it("sniffs the Format axis when the tier is missing", () => {
    expect(tierFor({ format: "Bare Root" })).toBe("bareroot");
    expect(tierFor({ format: "Bareroot" })).toBe("bareroot");
  });
  it("defaults to potted (never undercharge)", () => {
    expect(tierFor({ format: "Potted 12\"" })).toBe("potted");
    expect(tierFor({})).toBe("potted");
  });
});

describe("estimateShipping", () => {
  it("prices a green state per zone and tier", () => {
    // WV = zone_1: bareroot 21, potted 32
    expect(estimateShipping("WV", "bareroot")).toBe(21);
    expect(estimateShipping("WV", "potted")).toBe(32);
    // ME = zone_5: bareroot 25, potted 40
    expect(estimateShipping("ME", "potted")).toBe(40);
  });

  it("returns null for an ineligible state (never a guessed charge)", () => {
    expect(estimateShipping("CA", "potted")).toBeNull();
    expect(estimateShipping("", "potted")).toBeNull();
    expect(estimateShipping(null, "bareroot")).toBeNull();
  });

  it("honours a fetched rate table override", () => {
    const live = { zone_1: { potted: { base: 99 } } };
    expect(estimateShipping("WV", "potted", live)).toBe(99);
    // tier missing in the override → null, not a fallback to the snapshot
    expect(estimateShipping("WV", "bareroot", live)).toBeNull();
  });
});

describe("resolveRateTable", () => {
  it("uses the fetched table when non-empty, else the snapshot", () => {
    const live = { zone_1: { potted: { base: 99 } } };
    expect(resolveRateTable(live)).toBe(live);
    expect(resolveRateTable(null)).toBe(ZONE_RATE_TABLE);
    expect(resolveRateTable({})).toBe(ZONE_RATE_TABLE);
  });
});

// ── Box Engine v2 (schema-2) estimator leg — GOL-1114 ────────────────────────
// Verbatim mirror of grove_headless `rate_feed()` (data/shipping_rates.json v2
// + shipping_boxes.py BOXES). Kept identical to the odoo-client parity fixture
// so this test doubles as the frontend↔backend contract for the box feed.
const SCHEMA2_FEED: ShippingRateFeed = {
  schema: 2,
  zones: {
    zone_1: { br16: { base: 18 }, s20: { base: 22 }, s32: { base: 24 }, s46: { base: 26 }, b20: { base: 28 }, b32: { base: 30 } },
    zone_2: { br16: { base: 19 }, s20: { base: 23 }, s32: { base: 25 }, s46: { base: 27 }, b20: { base: 29 }, b32: { base: 31 } },
    zone_3: { br16: { base: 20 }, s20: { base: 24 }, s32: { base: 26 }, s46: { base: 28 }, b20: { base: 31 }, b32: { base: 33 } },
    zone_4: { br16: { base: 21 }, s20: { base: 25 }, s32: { base: 27 }, s46: { base: 30 }, b20: { base: 32 }, b32: { base: 34 } },
    zone_5: { br16: { base: 22 }, s20: { base: 26 }, s32: { base: 28 }, s46: { base: 31 }, b20: { base: 33 }, b32: { base: 36 } },
  },
  zone_by_state: { ...ZONE_BY_STATE },
  green_states: Object.keys(ZONE_BY_STATE).sort(),
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

describe("estimateBoxShipping (Box Engine v2 single-tree bareroot floor)", () => {
  it("picks the cheapest leafed-usable box ≥ the tree's length class, per zone", () => {
    // Default class 20, leafed → usable {s20,s32,s46}; cheapest is s20.
    expect(estimateBoxShipping("WV", SCHEMA2_FEED)).toBe(22); // zone_1 s20
    expect(estimateBoxShipping("ME", SCHEMA2_FEED)).toBe(26); // zone_5 s20
  });

  it("excludes the single-whip/bulk boxes in leafed mode (never undercharge)", () => {
    // A class-16 tree *could* ride the $18 br16 — but only when dormant. In the
    // conservative leafed default, br16 (and dormant-only b20/b32) drop out, so
    // the floor stays s20 = $22, not $18.
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 16 })).toBe(22);
    // Dormant mode admits the whip: class-16 dormant → br16 = $18.
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 16, mode: "dormant" })).toBe(18);
  });

  it("requires a box at least as long as a tall tree's class", () => {
    // Class 46 leafed → only s46 is long enough (b-boxes are dormant-only).
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 46 })).toBe(26);
    expect(estimateBoxShipping("ME", SCHEMA2_FEED, { lengthClass: 46 })).toBe(31);
  });

  it("returns null for an ineligible state or blank input (never a guess)", () => {
    expect(estimateBoxShipping("CA", SCHEMA2_FEED)).toBeNull();
    expect(estimateBoxShipping("", SCHEMA2_FEED)).toBeNull();
    expect(estimateBoxShipping(null, SCHEMA2_FEED)).toBeNull();
  });

  it("returns null when no box in the zone has a configured rate", () => {
    const emptyZone: ShippingRateFeed = {
      ...SCHEMA2_FEED,
      zones: { ...SCHEMA2_FEED.zones, zone_1: {} },
    };
    expect(estimateBoxShipping("WV", emptyZone)).toBeNull();
  });
});

describe("estimateTierShipping (Format-card ⟷ estimator seam)", () => {
  it("prices bareroot off the box feed when one is present", () => {
    // Box feed floor for WV bareroot is s20 = $22 (vs the $21 legacy snapshot).
    expect(estimateTierShipping("WV", "bareroot", { feed: SCHEMA2_FEED })).toBe(22);
  });

  it("keeps potted on the legacy tier path (pure pricing seam, no box route)", () => {
    // Potted is never routed through the box feed (no potted box by design).
    // estimateTierShipping stays a pure pricing function; the pickup-only policy
    // (GOL-1114) is a separate gate — see isPickupOnly — so callers that render
    // a shippable potted row (legacy backend) still get its tier rate here.
    expect(estimateTierShipping("WV", "potted", { feed: SCHEMA2_FEED })).toBe(32);
  });

  it("falls back to the tier-keyed snapshot with no feed", () => {
    expect(estimateTierShipping("WV", "bareroot")).toBe(21);
    expect(estimateTierShipping("WV", "potted")).toBe(32);
  });
});

describe("hasBoxFeed", () => {
  it("true for a well-formed schema-2 feed, false for null/empty", () => {
    expect(hasBoxFeed(SCHEMA2_FEED)).toBe(true);
    expect(hasBoxFeed(null)).toBe(false);
    expect(hasBoxFeed(undefined)).toBe(false);
  });
});

// GOL-1114 (ratified 2026-08-03): potted flips to farm-pickup-only exactly when
// Box Engine v2 is live (its SHIPPABLE_TIERS drops potted + checkout blocks a
// potted ship). Gating on the feed keeps the product page and checkout consistent
// in BOTH backend generations — no "ships now" the checkout would block, and no
// "pickup only" while the legacy backend still charges potted shipping.
describe("isPickupOnly (potted = farm pickup only under Box Engine v2)", () => {
  it("potted is pickup-only when the box feed is live", () => {
    expect(isPickupOnly("potted", SCHEMA2_FEED)).toBe(true);
  });
  it("potted still ships on the legacy backend (no feed)", () => {
    expect(isPickupOnly("potted", null)).toBe(false);
    expect(isPickupOnly("potted", undefined)).toBe(false);
  });
  it("bareroot is always shippable, never pickup-only", () => {
    expect(isPickupOnly("bareroot", SCHEMA2_FEED)).toBe(false);
    expect(isPickupOnly("bareroot", null)).toBe(false);
  });
});
