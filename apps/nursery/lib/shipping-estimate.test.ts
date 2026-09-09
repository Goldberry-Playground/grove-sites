import { describe, it, expect } from "vitest";
import { SHIP_TO_STATES } from "@grove/checkout";
import type { ShippingRateFeed } from "@grove/odoo-client";
import {
  ZONE_BY_STATE,
  estimateShipping,
  estimateBoxShipping,
  estimateBoxFloor,
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
  it("covers exactly the 31 green states", () => {
    expect(Object.keys(ZONE_BY_STATE).length).toBe(31);
  });

  it("keeps WV in the nearest zone (zone_1)", () => {
    expect(ZONE_BY_STATE.WV).toBe("zone_1");
    expect(ZONE_BY_STATE.ME).toBe("zone_5");
  });

  it("assigns the south/mid tranche its real GOL-2238 probe-derived zones", () => {
    // GOL-2238 re-probed the GOL-2128 tranche against the two-SKU catalog
    // (2026-09-08): only GA/SC/AL/MS/LA stay at zone_5 (39/43); AR/MO/IA drop to
    // zone_6 (23/28) and TN to zone_7 (29/32) — each zone still an upper bound
    // for its members' worst corners, so none is ever undercharged. DC = zone_1.
    for (const s of ["GA", "AL", "SC", "MS", "LA"]) {
      expect(ZONE_BY_STATE[s]).toBe("zone_5");
    }
    for (const s of ["AR", "MO", "IA"]) {
      expect(ZONE_BY_STATE[s]).toBe("zone_6");
    }
    expect(ZONE_BY_STATE.TN).toBe("zone_7");
    expect(ZONE_BY_STATE.DC).toBe("zone_1");
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
    zone_1: { small: { base: 22 }, large: { base: 36 } },
    zone_2: { small: { base: 22 }, large: { base: 36 } },
    zone_3: { small: { base: 22 }, large: { base: 36 } },
    zone_4: { small: { base: 47 }, large: { base: 54 } },
    zone_5: { small: { base: 41 }, large: { base: 52 } },
  },
  zone_by_state: { ...ZONE_BY_STATE },
  green_states: Object.keys(ZONE_BY_STATE).sort(),
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

describe("estimateBoxShipping (Box Engine v2 single-tree bareroot floor)", () => {
  it("picks the cheapest usable box ≥ the tree's length class, per zone", () => {
    // Two-SKU catalog: a single tree takes the cheaper box (small), per zone.
    expect(estimateBoxShipping("WV", SCHEMA2_FEED)).toBe(22); // zone_1 small
    expect(estimateBoxShipping("ME", SCHEMA2_FEED)).toBe(41); // zone_5 small
  });

  it("prices the same in either mode (both boxes carry both modes)", () => {
    // The descoped catalog holds the same count dormant or leafed, so a
    // single-tree quote no longer depends on the season.
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 16 })).toBe(22);
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 16, mode: "dormant" })).toBe(22);
  });

  it("returns null for a tree taller than any box (both are 24\")", () => {
    // A 24" tree still fits (box length 24 ≥ 24); a 30" tree has no box.
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 24 })).toBe(22);
    expect(estimateBoxShipping("WV", SCHEMA2_FEED, { lengthClass: 30 })).toBeNull();
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

describe("estimateBoxFloor (stateless Format-card 'from' floor — GOL-1822)", () => {
  it("is the cheapest single-tree box rate over every zone (class 20, leafed)", () => {
    // Usable ≥ class 20 → {small,large}; global min is zone_1 small = 22.
    expect(estimateBoxFloor(SCHEMA2_FEED)).toBe(22);
  });

  it("honours the same box-eligibility rules as the per-state estimate", () => {
    // Same catalog in either mode → floor stays small = 22.
    expect(estimateBoxFloor(SCHEMA2_FEED, { lengthClass: 16 })).toBe(22);
    expect(estimateBoxFloor(SCHEMA2_FEED, { lengthClass: 16, mode: "dormant" })).toBe(22);
    // A 30" tree has no box in this catalog → no floor.
    expect(estimateBoxFloor(SCHEMA2_FEED, { lengthClass: 30 })).toBeNull();
  });

  it("never exceeds any priced state's per-box estimate (a true 'from' floor)", () => {
    // The whole point (GOL-1822): the stateless card number must be ≤ every
    // state-specific quote, so it can never under-quote what a shopper is later
    // charged — unlike the legacy per-tree $12 hint it replaces.
    const floor = estimateBoxFloor(SCHEMA2_FEED);
    expect(floor).not.toBeNull();
    for (const state of Object.keys(ZONE_BY_STATE)) {
      const perState = estimateBoxShipping(state, SCHEMA2_FEED);
      if (perState != null) expect(floor!).toBeLessThanOrEqual(perState);
    }
  });

  it("returns null when no box has a configured rate (never a guess)", () => {
    const noRates: ShippingRateFeed = {
      ...SCHEMA2_FEED,
      zones: { zone_1: {}, zone_2: {}, zone_3: {}, zone_4: {}, zone_5: {} },
    };
    expect(estimateBoxFloor(noRates)).toBeNull();
  });
});

describe("estimateTierShipping (Format-card ⟷ estimator seam)", () => {
  it("prices bareroot off the box feed when one is present", () => {
    // Box feed floor for WV bareroot is the small box = $22.
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
