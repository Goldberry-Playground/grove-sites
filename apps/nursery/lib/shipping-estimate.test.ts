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
  hasPottedRates,
  estimatePottedShipping,
  estimatePottedFloor,
  estimateTierFloor,
  isPickupOnly,
  shipsTo,
  tierFor,
  resolveRateTable,
  resolveZoneMap,
  SNAPSHOT_ZONE_MAP,
  ZONE_RATE_TABLE,
  GREEN_STATE_COUNT,
  NON_STATE_GREEN_DESTINATIONS,
  US_STATE_NAMES,
  shipScope,
} from "./shipping-estimate";
import zoneMapFixture from "./__fixtures__/shipping-zone-map.fixture.json";

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
  it("covers exactly the 32 green states", () => {
    expect(Object.keys(ZONE_BY_STATE).length).toBe(32);
  });

  it("keeps WV in the nearest zone (zone_1)", () => {
    expect(ZONE_BY_STATE.WV).toBe("zone_1");
    expect(ZONE_BY_STATE.ME).toBe("zone_5");
  });

  it("mirrors the GOL-2238 P1 correction (5 zones, no zone_6/zone_7)", () => {
    // GOL-2238 P1 (2026-09-14) retired the 2026-09-08 zone_6/zone_7 mis-bin: a
    // live re-probe folded TN back to zone_1 (Memphis quotes the zone_1 rate
    // exactly; it borders KY/VA/NC) and AR/MO/IA back to their real zone_5 rate.
    // The backend rate table is 5 zones again — the baked map must match.
    for (const s of ["GA", "AL", "SC", "MS", "LA", "AR", "MO", "IA"]) {
      expect(ZONE_BY_STATE[s]).toBe("zone_5");
    }
    expect(ZONE_BY_STATE.TN).toBe("zone_1");
    expect(ZONE_BY_STATE.DC).toBe("zone_1");
    // no state binds to a retired band, and the rate table carries none.
    expect(Object.values(ZONE_BY_STATE)).not.toContain("zone_6");
    expect(Object.values(ZONE_BY_STATE)).not.toContain("zone_7");
    expect(ZONE_RATE_TABLE.zone_6).toBeUndefined();
    expect(ZONE_RATE_TABLE.zone_7).toBeUndefined();
  });

  it("green-lists Florida at zone_5 (GOL-2235, mirrors backend)", () => {
    // FL opened on the GOL-2132 compliance carve-out gate; its worst corners
    // (Miami/Key West) quote at or under the zone_5 published rate, so it bins
    // there with no new band and is never undercharged.
    expect(ZONE_BY_STATE.FL).toBe("zone_5");
    expect(shipsTo("FL")).toBe(true);
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

// ── GOL-2292: the estimator's zone map must be feed-driven ───────────────────
// The PDP once showed $39 for TN while checkout charged $29: a backend re-zoning
// (TN → zone_7, GOL-2238) repriced checkout, but the storefront resolved *which
// zone* a state is in from the baked ZONE_BY_STATE snapshot, which only updates on
// a frontend release. These tests lock in the two halves of the fix: (1) a drift
// guard so the baked snapshot can't silently diverge from the live feed, and
// (2) resolveZoneMap()/shipsTo()/estimate* prefer the live feed over the snapshot.

// The baked snapshot is a FALLBACK, but it must stay honest: it can't quietly
// drift from what the backend actually prices. The fixture is a captured slice of
// the live /shipping/rates feed (grove_headless ZONE_BY_STATE / GREEN_STATES). If
// the backend re-zones without refreshing both the fixture AND ZONE_BY_STATE in
// the same PR, this fails in CI rather than mispricing a PDP on prod.
describe("snapshot ⟷ live-feed zone map drift guard (GOL-2292)", () => {
  it("baked ZONE_BY_STATE matches the captured feed fixture exactly", () => {
    expect(ZONE_BY_STATE).toEqual(zoneMapFixture.zone_by_state);
  });

  it("baked green list matches the feed's green_states (sorted)", () => {
    expect(Object.keys(ZONE_BY_STATE).sort()).toEqual(
      [...zoneMapFixture.green_states].sort(),
    );
  });

  it("SNAPSHOT_ZONE_MAP mirrors the baked constant", () => {
    expect(SNAPSHOT_ZONE_MAP.zoneByState).toBe(ZONE_BY_STATE);
    expect(SNAPSHOT_ZONE_MAP.greenStates.sort()).toEqual(Object.keys(ZONE_BY_STATE).sort());
  });
});

describe("resolveZoneMap (feed-first, snapshot fallback — GOL-2292)", () => {
  it("prefers the live feed's zone_by_state / green_states", () => {
    const live = { zone_by_state: { FL: "zone_5", TN: "zone_7" }, green_states: ["FL", "TN"] };
    const resolved = resolveZoneMap(live);
    expect(resolved.zoneByState).toBe(live.zone_by_state);
    expect(resolved.greenStates).toEqual(["FL", "TN"]);
  });

  it("derives green_states from zone_by_state keys when the feed omits them", () => {
    const resolved = resolveZoneMap({ zone_by_state: { WV: "zone_1", OH: "zone_2" } });
    expect(resolved.greenStates.sort()).toEqual(["OH", "WV"]);
  });

  it("falls back to the baked snapshot for a null/empty/mapless feed", () => {
    expect(resolveZoneMap(null)).toBe(SNAPSHOT_ZONE_MAP);
    expect(resolveZoneMap(undefined)).toBe(SNAPSHOT_ZONE_MAP);
    expect(resolveZoneMap({ zone_by_state: {}, green_states: [] })).toBe(SNAPSHOT_ZONE_MAP);
  });

  it("accepts the full schema-2 feed shape (same wire fields)", () => {
    const resolved = resolveZoneMap(SCHEMA2_FEED);
    expect(resolved.zoneByState).toBe(SCHEMA2_FEED.zone_by_state);
  });
});

describe("shipsTo / estimate* honour a live zone map over the snapshot (GOL-2292)", () => {
  // A hypothetical backend re-zoning the snapshot doesn't know about yet: TX
  // (still a NOT-green far state in the baked map) is opened, and WV is moved to
  // a farther band than the baked snapshot holds. Uses states whose baked value
  // still differs from the feed so the feed-first behaviour is actually exercised.
  const liveMap = resolveZoneMap({
    zone_by_state: { ...ZONE_BY_STATE, TX: "zone_5", WV: "zone_5" },
  });

  it("shipsTo gates on the live green list, not the baked one", () => {
    expect(shipsTo("TX")).toBe(false); // snapshot: not green yet
    expect(shipsTo("TX", liveMap)).toBe(true); // live feed opened it
  });

  it("estimateTierShipping resolves the state's zone from the live map", () => {
    // Baked WV is zone_1 (potted $32). The live map re-bands WV to zone_5 (potted
    // $40): passing the live zoneMap must follow the feed, not the stale snapshot —
    // exactly the PDP-vs-checkout drift this ticket fixes.
    expect(estimateTierShipping("WV", "potted")).toBe(32); // snapshot zone_1
    expect(estimateTierShipping("WV", "potted", { zoneMap: liveMap })).toBe(40); // live zone_5
  });

  it("estimateShipping accepts a zoneByState override directly", () => {
    expect(estimateShipping("TX", "potted")).toBeNull(); // not in the snapshot
    expect(estimateShipping("TX", "potted", ZONE_RATE_TABLE, liveMap.zoneByState)).toBe(40); // zone_5
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
    // This feed carries no potted rate rows, so potted still falls through to
    // the legacy tier-keyed snapshot. See the #813 block below for the feed
    // generation that does price potted.
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

// The same schema-2 feed AFTER the GOL-2199 potted go-live: `zones` now carries
// rated potted box rows (p24x10x4 / p24x10x6), mirroring the shape of the live
// `data/shipping_rates.json`. Note `packing.boxes` is UNCHANGED — the backend's
// `rate_feed()` builds it from BOXES only and never publishes POTTED_BOXES, so a
// client sees potted RATES but no potted SPECS. That asymmetry is exactly why
// the pickup-only gate reads `zones`, not `packing.boxes` (grove-sites#813).
const SCHEMA2_POTTED_FEED: ShippingRateFeed = {
  ...SCHEMA2_FEED,
  zones: {
    zone_1: { small: { base: 16 }, large: { base: 22 }, p24x10x4: { base: 20 }, p24x10x6: { base: 27 } },
    zone_2: { small: { base: 22 }, large: { base: 36 }, p24x10x4: { base: 24 }, p24x10x6: { base: 31 } },
    zone_3: { small: { base: 22 }, large: { base: 36 }, p24x10x4: { base: 26 }, p24x10x6: { base: 34 } },
    zone_4: { small: { base: 47 }, large: { base: 54 }, p24x10x4: { base: 38 }, p24x10x6: { base: 49 } },
    zone_5: { small: { base: 41 }, large: { base: 52 }, p24x10x4: { base: 26 }, p24x10x6: { base: 41 } },
  },
};

describe("hasBoxFeed", () => {
  it("true for a well-formed schema-2 feed, false for null/empty", () => {
    expect(hasBoxFeed(SCHEMA2_FEED)).toBe(true);
    expect(hasBoxFeed(null)).toBe(false);
    expect(hasBoxFeed(undefined)).toBe(false);
  });
});

// GOL-1114 (ratified 2026-08-03) flipped potted to farm-pickup-only, then
// GOL-2199 (2026-09-08) put potted back on its own shipping engine. The
// invariant across both is unchanged: the page and checkout must agree. The
// signal that tracks checkout is a RATED POTTED ROW in the feed, because that is
// the backend's own fail-safe condition (`pack_potted` -> None -> checkout
// refuses the line). So a schema-2 feed that prices no potted box still reads
// pickup-only, exactly as before.
describe("isPickupOnly (potted, feed with NO potted rates)", () => {
  it("potted is pickup-only when the box feed prices no potted box", () => {
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

// grove-sites#813 / GOL-2757 — the potted go-live reaching the storefront. The
// PDP told shoppers potted was "Farm pickup only" while the backend had priced
// potted boxes and would ship them (SHIPPABLE_TIERS = {"bareroot","potted"}).
describe("grove-sites#813 — potted ships once the feed prices a potted box", () => {
  it("hasPottedRates distinguishes the two schema-2 generations", () => {
    expect(hasPottedRates(SCHEMA2_POTTED_FEED)).toBe(true);
    expect(hasPottedRates(SCHEMA2_FEED)).toBe(false); // schema-2, no potted rows
    expect(hasPottedRates(null)).toBe(false);
    expect(hasPottedRates(undefined)).toBe(false);
  });

  it("potted is NO LONGER pickup-only once the feed prices it", () => {
    expect(isPickupOnly("potted", SCHEMA2_POTTED_FEED)).toBe(false);
  });

  it("the per-product override still outranks the potted rates (GOL-2588)", () => {
    expect(isPickupOnly("potted", SCHEMA2_POTTED_FEED, true)).toBe(true);
    expect(isPickupOnly("bareroot", SCHEMA2_POTTED_FEED, true)).toBe(true);
  });

  it("bareroot is untouched by the potted rows", () => {
    expect(isPickupOnly("bareroot", SCHEMA2_POTTED_FEED)).toBe(false);
    expect(estimateTierShipping("WV", "bareroot", { feed: SCHEMA2_POTTED_FEED })).toBe(16);
  });

  it("prices one potted unit off the cheapest rated potted box for the state's zone", () => {
    // WV = zone_1 -> cheapest of p24x10x4 $20 / p24x10x6 $27
    expect(estimatePottedShipping("WV", SCHEMA2_POTTED_FEED)).toBe(20);
    // MN = zone_4 -> cheapest of $38 / $49
    expect(estimatePottedShipping("MN", SCHEMA2_POTTED_FEED)).toBe(38);
  });

  it("returns null for a state outside the green list, never an invented rate", () => {
    expect(estimatePottedShipping("CA", SCHEMA2_POTTED_FEED)).toBeNull();
    expect(estimatePottedShipping(null, SCHEMA2_POTTED_FEED)).toBeNull();
  });

  it("routes potted through the box feed, NOT the per-tree legacy snapshot", () => {
    // The legacy tier-keyed table says $32/tree for WV potted; the box engine
    // charges $20 for a carton of up to five. Falling through would over-quote.
    expect(estimateTierShipping("WV", "potted", { feed: SCHEMA2_POTTED_FEED })).toBe(20);
    expect(estimateTierShipping("WV", "potted", { feed: SCHEMA2_FEED })).toBe(32);
  });

  it("the from-$X floor is per tier, so a potted card cannot quote the bareroot floor", () => {
    expect(estimateTierFloor("bareroot", SCHEMA2_POTTED_FEED)).toBe(16); // zone_1 small
    expect(estimateTierFloor("potted", SCHEMA2_POTTED_FEED)).toBe(20); // zone_1 p24x10x4
    expect(estimatePottedFloor(SCHEMA2_POTTED_FEED)).toBe(20);
  });

  it("the tier floor can never exceed the state estimate it precedes", () => {
    const floor = estimateTierFloor("potted", SCHEMA2_POTTED_FEED)!;
    for (const st of Object.keys(ZONE_BY_STATE)) {
      const est = estimatePottedShipping(st, SCHEMA2_POTTED_FEED);
      if (est != null) expect(floor).toBeLessThanOrEqual(est);
    }
  });

  it("a partially-rated feed still ships: one rated potted box is enough", () => {
    const partial: ShippingRateFeed = {
      ...SCHEMA2_FEED,
      zones: { ...SCHEMA2_FEED.zones, zone_1: { small: { base: 16 }, p24x10x6: { base: 27 } } },
    };
    expect(hasPottedRates(partial)).toBe(true);
    expect(isPickupOnly("potted", partial)).toBe(false);
    expect(estimatePottedShipping("WV", partial)).toBe(27);
    // a zone with no potted row of its own quotes nothing rather than guessing
    expect(estimatePottedShipping("MN", partial)).toBeNull();
  });
});

// GOL-2587 P1 → GOL-2588: the per-template `grove_pickup_only` override. The
// backend gate it mirrors rejects a SHIP order containing such a line WHATEVER
// the shipping tier and whichever backend generation is live, so the storefront
// override must outrank both signals — otherwise the PDP would promise shipping
// on a bareroot line that checkout then refuses with a 400.
describe("isPickupOnly — per-product override (GOL-2588)", () => {
  it("forces pickup-only for bareroot, the otherwise-always-shippable tier", () => {
    expect(isPickupOnly("bareroot", SCHEMA2_FEED, true)).toBe(true);
  });
  it("forces pickup-only on the legacy backend too (no box feed)", () => {
    expect(isPickupOnly("bareroot", null, true)).toBe(true);
    expect(isPickupOnly("potted", null, true)).toBe(true);
  });
  it("leaves the potted rule untouched when the override is absent or false", () => {
    expect(isPickupOnly("potted", SCHEMA2_FEED, false)).toBe(true); // no potted rates -> still pickup
    expect(isPickupOnly("bareroot", SCHEMA2_FEED, false)).toBe(false);
    expect(isPickupOnly("bareroot", SCHEMA2_FEED, null)).toBe(false);
    expect(isPickupOnly("bareroot", SCHEMA2_FEED, undefined)).toBe(false);
  });
});

/**
 * GOL-2588 invariant guard for `compliance_exempt`.
 *
 * The exemption lets checkout skip the per-line GOL-2132 carve-out so the line
 * ships anywhere **on the green list**. It is NOT a licence to ship outside it.
 * The storefront's only per-state plant-health surface is this green-list gate,
 * so an exempt product must resolve state eligibility identically to a
 * non-exempt one. `shipsTo` taking no product argument is what enforces that
 * structurally; this test pins the intent so a future "exempt widens the state
 * select" change has to argue with a named invariant instead of slipping in.
 */
describe("compliance exemption never widens the green list (GOL-2588)", () => {
  it("keeps the state gate purely state-level: OH in, TX and CA out", () => {
    expect(shipsTo("OH")).toBe(true); // green, and where the P1 bundles were blocked
    expect(shipsTo("TX")).toBe(false); // ratified on cost, still not green
    expect(shipsTo("CA")).toBe(false); // plant-health closed
  });
  it("answers the same for every product, exempt or not (state-level only)", () => {
    // The exemption lives on the product; eligibility is asked of the STATE. The
    // helper takes no product, which is the structural guarantee — a future
    // per-product widening would have to change this signature first.
    for (const state of ["OH", "IN", "WI", "FL"]) {
      expect(shipsTo(state)).toBe(true); // regulated AND green: same answer either way
    }
    for (const state of ["OR", "WA", "AZ", "NM", "CA"]) {
      expect(shipsTo(state)).toBe(false); // regulated and NOT green: still closed
    }
  });
});

// GOL-2941: the live green list is a *destination* list keyed by USPS code, and
// DC is a federal district. Copy used to interpolate the raw count next to the
// word "states", which published the claim that D.C. is a state. `shipScope()`
// keeps the never-drift property (GOL-2128) — the figure is still derived from
// the engine mirror — while naming non-state destinations outright.
describe("shipScope — derived ship-scope wording (GOL-2941)", () => {
  it("subtracts non-state destinations from the state count and names them", () => {
    const scope = shipScope();
    const nonStateCodes = Object.keys(ZONE_BY_STATE).filter(
      (code) => code in NON_STATE_GREEN_DESTINATIONS,
    );
    expect(nonStateCodes).toContain("DC");
    expect(scope.stateCount).toBe(GREEN_STATE_COUNT - nonStateCodes.length);
    expect(scope.phrase).toBe(`${scope.stateCount} states and Washington, D.C.`);
    expect(scope.phraseUS).toBe(
      `${scope.stateCount} U.S. states and Washington, D.C.`,
    );
    expect(scope.shortPhrase).toBe(`${scope.stateCount} states + D.C.`);
  });

  it("never captions D.C. as a state", () => {
    const scope = shipScope();
    // The published figure + the spelled-out list must agree on the total.
    expect(scope.stateCount + scope.nonStateNames.length).toBe(
      GREEN_STATE_COUNT,
    );
    expect(scope.phrase).not.toMatch(
      new RegExp(`${GREEN_STATE_COUNT} (U\\.S\\. )?states`),
    );
  });

  it("tracks a live green list rather than the baked snapshot", () => {
    // A live feed that drops a state must move the figure without a release.
    const live = Object.keys(ZONE_BY_STATE).filter((c) => c !== "WV");
    expect(shipScope(live).stateCount).toBe(shipScope().stateCount - 1);
    expect(shipScope(live).phrase).toContain("Washington, D.C.");
  });

  it("a second non-state destination cannot silently re-break the noun", () => {
    const withTerritory = [...Object.keys(ZONE_BY_STATE), "PR"];
    // Unregistered code counts as a state until it is declared non-state …
    expect(shipScope(withTerritory).stateCount).toBe(
      shipScope().stateCount + 1,
    );
    // … and the guard below is what forces that declaration.
    NON_STATE_GREEN_DESTINATIONS.PR = "Puerto Rico";
    try {
      const scope = shipScope(withTerritory);
      expect(scope.stateCount).toBe(shipScope().stateCount);
      expect(scope.phrase).toBe(
        `${scope.stateCount} states and Washington, D.C. and Puerto Rico`,
      );
    } finally {
      delete NON_STATE_GREEN_DESTINATIONS.PR;
    }
  });

  it("drops the tail entirely when every green destination is a state", () => {
    const statesOnly = Object.keys(ZONE_BY_STATE).filter(
      (code) => !(code in NON_STATE_GREEN_DESTINATIONS),
    );
    const scope = shipScope(statesOnly);
    expect(scope.phrase).toBe(`${scope.stateCount} states`);
    expect(scope.shortPhrase).toBe(`${scope.stateCount} states`);
    expect(scope.nonStateNames).toEqual([]);
  });

  it("every non-state green code is declared, so the noun can never go stale", () => {
    // The guard: if the green list gains a non-state destination (territory,
    // district) and nobody declares it, this fails instead of publishing it as
    // a state. Known non-states carry a non-state US_STATE_NAMES label.
    const undeclared = Object.keys(ZONE_BY_STATE).filter(
      (code) =>
        !(code in NON_STATE_GREEN_DESTINATIONS) &&
        /District|Puerto Rico|Virgin Islands|Guam|Samoa|Mariana/i.test(
          US_STATE_NAMES[code] ?? "",
        ),
    );
    expect(undeclared).toEqual([]);
  });
});
