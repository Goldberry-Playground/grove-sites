import { describe, it, expect } from "vitest";
import type { ShippingCalendar } from "@grove/odoo-client";
import {
  resolveShippableMode,
  monthDayOf,
  barerootBadge,
  barerootTimingShort,
  barerootNote,
  formatMonthDay,
  orderDeadlineLine,
  tierFulfillment,
  DEPOSIT_CUTOVER,
  depositByDate,
  zoneShipNote,
  shipWindowEnvelope,
  formatWindow,
  monthsCovered,
  servedZoneSpan,
  DEFAULT_WINDOWS,
  type ShippableMode,
} from "./fulfillment-mode";

// GOL-2233 (CEO ruling 2026-09-09) — the deposit CHARGE shape is decided by the
// backend `_order_takes_deposit` rule (sold-out bareroot OR after the Oct 15
// season cutover), NOT the ship-window calendar. The calendar (schema-2, per-USDA
// zone — GOL-1172/1177) still drives ship TIMING (which season, plus the peat &
// bagged leafed fallback). These tests pin both axes independently.

const CAL: ShippingCalendar = {
  preorder_open: { fall: [8, 15], spring: [11, 1] },
  leafed_window: [
    [5, 6],
    [8, 14],
  ],
  fulfillment_days: [5, 10],
  zones: {
    "6": {
      fall: [
        [9, 15],
        [10, 30],
      ],
      spring: [
        [1, 1],
        [5, 5],
      ],
    },
  },
};

/** Build a UTC date from a [month, day] so no local-timezone offset can shift
 *  which mode a boundary date resolves to. */
const on = (month: number, day: number) => new Date(Date.UTC(2026, month - 1, day));
/** In-stock (default) resolution mode — the common storefront case. */
const modeOn = (month: number, day: number): ShippableMode =>
  resolveShippableMode(on(month, day), CAL).mode;
/** Sold-out-variant resolution — the sold-out deposit trigger. */
const soldOutOn = (month: number, day: number) =>
  resolveShippableMode(on(month, day), CAL, null, { soldOut: true });

describe("ship-window timing — in-stock bareroot, on/before the Oct 15 cutover", () => {
  // An in-stock variant on/before the cutover always ships now and is charged in
  // full (never a deposit); the calendar only decides in-window vs peat & bagged.
  it("Jan 1 → May 5: spring bareroot ships now, charged in full", () => {
    for (const [m, d] of [[1, 1], [2, 14], [3, 20], [5, 5]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.mode).toBe("bareroot-in-window");
      expect(r.depositNow).toBe(false);
      expect(r.depositReason).toBeNull();
      expect(r.shipSeason).toBeNull();
    }
  });

  it("May 6 → Aug 14: peat & bagged (leafed, 5–10 business days), charged in full", () => {
    for (const [m, d] of [[5, 6], [6, 15], [7, 4], [8, 14]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.mode).toBe("peat-and-bagged");
      expect(r.depositNow).toBe(false);
    }
  });

  it("Aug 15 → Sep 14: RETIRED fall-preorder window is charged in full, but SHIPS in the fall window (GOL-2233 + grove-sites#814)", () => {
    // The crux of the ruling: the GOL-1114 calendar copy showed "PREORDER —
    // deposit now" here. An in-stock variant on/before Oct 15 no longer deposits.
    // But the CHARGE moving did not move the TIMING: zone 6 ships Sep 15 - Oct 30,
    // so these dates are charged now and ship in that wave. Fusing the two made
    // the copy claim "Ships now" on a date no zone ships on (grove-sites#814).
    for (const [m, d] of [[8, 15], [8, 31], [9, 14]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.mode).toBe("bareroot-in-window");
      expect(r.depositNow).toBe(false);
      expect(r.depositReason).toBeNull();
      expect(r.shipSeason).toBe("fall"); // NOT shipping today
    }
  });

  it("Sep 15 → Oct 15: fall window is OPEN, so bareroot really does ship now", () => {
    for (const [m, d] of [[9, 15], [10, 1], [10, 15]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.mode).toBe("bareroot-in-window");
      expect(r.depositNow).toBe(false);
      expect(r.shipSeason).toBeNull(); // window open → ships today
    }
  });
});

// grove-sites#814 / GOL-2757 — "Ships now · charged in full" used to render on
// every in-stock pre-cutover date, including the gap between the preorder switch
// and the zone's window. Charge and timing are now separate clauses, and only an
// OPEN window may say "Ships now".
describe("grove-sites#814 — charge and ship timing are separate clauses", () => {
  it("in the pre-window gap: charged in full today, ships in the named wave", () => {
    const r = resolveShippableMode(on(9, 1), CAL); // zone 6 ships Sep 15 - Oct 30
    expect(r.depositNow).toBe(false);
    expect(r.shipSeason).toBe("fall");
    expect(barerootTimingShort(r)).toBe("Charged in full today · ships this fall");
    expect(barerootNote(r)).toContain("Charged in full today");
    expect(barerootNote(r)).toContain("ship them dormant this fall");
    // the defect: never claim same-day shipping outside an open window
    expect(barerootTimingShort(r)).not.toContain("Ships now");
    expect(barerootNote(r)).not.toContain("Ships now");
  });

  it("inside an open window: the ships-now claim is kept, because it is true", () => {
    const r = resolveShippableMode(on(10, 1), CAL); // inside zone 6's fall window
    expect(r.shipSeason).toBeNull();
    expect(barerootTimingShort(r)).toBe("Ships now · charged in full");
    expect(barerootNote(r)).toContain("Ships now and charged in full today");
  });

  it("no in-stock pre-cutover day claims ships-now outside an open window", () => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth[m - 1]; d++) {
        const r = resolveShippableMode(on(m, d), CAL);
        if (r.mode !== "bareroot-in-window") continue;
        const claimsNow = barerootTimingShort(r).includes("Ships now");
        // ships-now is claimed if and only if no upcoming wave is pending
        expect(claimsNow).toBe(r.shipSeason === null);
      }
    }
  });

  it("a deposit order still names its wave (charge changed, phrasing did not)", () => {
    const r = resolveShippableMode(on(11, 15), CAL);
    expect(r.depositNow).toBe(true);
    expect(r.shipSeason).toBe("spring");
    expect(barerootTimingShort(r)).toBe("$10 to reserve · ships this spring");
  });
});

// grove-sites#815 / GOL-2757 — the deposit half of the GOL-2233 rule is pure
// date arithmetic against a local constant, so a feedless surface must still
// state it. `depositByDate` is that feed-free answer.
describe("grove-sites#815 — depositByDate (feed-free deposit rule)", () => {
  it("is false on/before the cutover and true after it", () => {
    expect(depositByDate(on(10, 15))).toBe(false);
    expect(depositByDate(on(10, 16))).toBe(true);
    expect(depositByDate(on(1, 1))).toBe(false);
    expect(depositByDate(on(12, 31))).toBe(true);
  });

  it("agrees with the full resolver's depositNow on every in-stock day", () => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth[m - 1]; d++) {
        expect(depositByDate(on(m, d))).toBe(resolveShippableMode(on(m, d), CAL).depositNow);
      }
    }
  });

  it("honours an injected cutover, like the resolver's depositCutover opt", () => {
    expect(depositByDate(on(10, 1), [9, 30])).toBe(true);
    expect(depositByDate(on(9, 30), [9, 30])).toBe(false);
  });
});

describe("GOL-2233 deposit rule — charge keys to sold-out / Oct 15 cutover, not the calendar", () => {
  it("DEPOSIT_CUTOVER mirrors the backend default (Oct 15)", () => {
    expect(DEPOSIT_CUTOVER).toEqual([10, 15]);
  });

  it("in-stock, on/before the cutover → charged in full (no deposit)", () => {
    for (const [m, d] of [[8, 20], [9, 20], [10, 15]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.depositNow).toBe(false);
    }
  });

  it("sold-out variant, on/before the cutover → flat $10 deposit, reason sold-out", () => {
    const r = soldOutOn(9, 20); // fall window, but sold out
    expect(r.mode).toBe("bareroot-preorder");
    expect(r.depositNow).toBe(true);
    expect(r.depositReason).toBe("sold-out");
    expect(r.shipSeason).toBe("fall");
  });

  it("after the cutover → flat $10 deposit even when in stock, reason off-season", () => {
    for (const [m, d] of [[10, 16], [11, 15], [12, 31]] as const) {
      const r = resolveShippableMode(on(m, d), CAL); // in stock
      expect(r.mode).toBe("bareroot-preorder");
      expect(r.depositNow).toBe(true);
      expect(r.depositReason).toBe("off-season");
      expect(r.shipSeason).not.toBeNull();
    }
  });

  it("the cutover is exclusive: Oct 15 charges in full, Oct 16 deposits", () => {
    expect(resolveShippableMode(on(10, 15), CAL).depositNow).toBe(false);
    expect(resolveShippableMode(on(10, 16), CAL).depositNow).toBe(true);
    expect(resolveShippableMode(on(10, 16), CAL).depositReason).toBe("off-season");
  });

  it("the cutover date is injectable (mirrors the backend ir.config_parameter)", () => {
    // Move the cutover to Sep 30: Oct 1 (in stock) now deposits as off-season.
    const early = resolveShippableMode(on(10, 1), CAL, null, { depositCutover: [9, 30] });
    expect(early.depositNow).toBe(true);
    expect(early.depositReason).toBe("off-season");
  });

  it("after the cutover, sold-out still reads as off-season (cutover dominates)", () => {
    const r = resolveShippableMode(on(11, 15), CAL, null, { soldOut: true });
    expect(r.depositReason).toBe("off-season");
  });
});

describe("edge cases — no dead months, one mode per day", () => {
  it("Oct 31 gap: in stock → after-cutover deposit; sold out → deposit", () => {
    // Past the fall window and after Oct 15: every bareroot order now deposits.
    expect(resolveShippableMode(on(10, 31), CAL).depositNow).toBe(true);
    expect(soldOutOn(10, 31).depositNow).toBe(true);
  });

  it("every day of the year resolves to exactly one mode (in-stock view)", () => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const seen = new Set<ShippableMode>();
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth[m - 1]; d++) {
        const r = resolveShippableMode(on(m, d), CAL);
        expect(["bareroot-preorder", "bareroot-in-window", "peat-and-bagged"]).toContain(r.mode);
        // deposit is taken exactly when (and only when) the mode is a reserve
        expect(r.depositNow).toBe(r.mode === "bareroot-preorder");
        // a pending wave is named exactly when the order does NOT ship today:
        // every deposit order, plus a charged-in-full order still awaiting its
        // zone window (grove-sites#814). Peat & bagged always ships today.
        if (r.mode === "bareroot-preorder") expect(r.shipSeason).not.toBeNull();
        if (r.mode === "peat-and-bagged") expect(r.shipSeason).toBeNull();
        seen.add(r.mode);
      }
    }
    // all three modes are reachable across the in-stock year — none is dead code
    expect(seen).toEqual(new Set(["bareroot-preorder", "bareroot-in-window", "peat-and-bagged"]));
  });

  it("boundary days switch cleanly (in-stock view)", () => {
    expect(modeOn(5, 5)).toBe("bareroot-in-window"); // last spring ship day
    expect(modeOn(5, 6)).toBe("peat-and-bagged"); // first leafed day
    expect(modeOn(8, 14)).toBe("peat-and-bagged"); // last leafed day
    expect(modeOn(8, 15)).toBe("bareroot-in-window"); // charged in full, ships in the fall window (was preorder)
    expect(modeOn(10, 15)).toBe("bareroot-in-window"); // last day on/before cutover
    expect(modeOn(10, 16)).toBe("bareroot-preorder"); // first day after cutover → deposit
  });
});

describe("zone staggering — timing/season reads the zone; the charge does not", () => {
  const laterZone = 3;
  const STAGGERED: ShippingCalendar = {
    ...CAL,
    zones: {
      ...CAL.zones,
      "3": {
        fall: [
          [10, 1],
          [10, 30],
        ],
        spring: [
          [1, 1],
          [5, 5],
        ],
      },
    },
  };

  it("in stock on/before the cutover → ships now for both zones (charge is zone-agnostic)", () => {
    expect(resolveShippableMode(on(9, 20), STAGGERED, laterZone).depositNow).toBe(false);
    expect(resolveShippableMode(on(9, 20), STAGGERED, 6).depositNow).toBe(false);
  });

  it("sold-out reserve names the later zone's fall season (its window has not opened yet)", () => {
    const r = resolveShippableMode(on(9, 20), STAGGERED, laterZone, { soldOut: true });
    expect(r.mode).toBe("bareroot-preorder");
    expect(r.shipSeason).toBe("fall");
  });

  it("sold-out reserve names the earlier zone's in-window season", () => {
    const r = resolveShippableMode(on(9, 20), STAGGERED, 6, { soldOut: true });
    expect(r.mode).toBe("bareroot-preorder");
    expect(r.shipSeason).toBe("fall");
  });
});

describe("crash safety, fallback windows, advisory fields", () => {
  it("a calendar missing preorder_open never throws → peat & bagged when in stock", () => {
    const partial = { ...CAL, preorder_open: undefined } as unknown as ShippingCalendar;
    expect(() => resolveShippableMode(on(8, 20), partial)).not.toThrow();
    expect(resolveShippableMode(on(8, 20), partial).mode).toBe("peat-and-bagged");
  });

  it("empty-zones fallback: after the cutover deposits regardless of the fallback window", () => {
    // GOL-2233 supersedes GOL-1313 finding 2's deposit-forcing: the charge is now
    // decided by the cutover, and ship timing is deferred to the dormancy gate.
    const noZones = { ...CAL, zones: {} } as ShippingCalendar;
    // Jan 15 in stock, before the cutover → ships now, charged in full.
    expect(resolveShippableMode(on(1, 15), noZones).depositNow).toBe(false);
    // Nov 15 is after the cutover → deposit (off-season).
    expect(resolveShippableMode(on(11, 15), noZones).depositNow).toBe(true);
    // Apr 1 in the spring fallback window → ships now, charged in full.
    expect(resolveShippableMode(on(4, 1), noZones).mode).toBe("bareroot-in-window");
  });

  it("surfaces approximate + weather_hold_note from the feed", () => {
    const held: ShippingCalendar = {
      ...CAL,
      approximate: false,
      weather_hold_note: "Hard freeze in the Ohio Valley — shipments held through the weekend.",
    };
    const r = resolveShippableMode(on(4, 1), held, 6);
    expect(r.approximate).toBe(false);
    expect(r.weatherHoldNote).toBe(held.weather_hold_note);
  });

  it("defaults approximate to true and weatherHoldNote to null when the feed omits them", () => {
    const r = resolveShippableMode(on(4, 1), CAL, 6);
    expect(r.approximate).toBe(true);
    expect(r.weatherHoldNote).toBeNull();
  });

  it("known zone surfaces its per-season order deadline on a reserve; peat does not", () => {
    const withDeadlines: ShippingCalendar = {
      ...CAL,
      zones: {
        "6": {
          ...CAL.zones["6"],
          fall_order_deadline: [11, 21],
          spring_order_deadline: [3, 29],
        },
      },
    };
    // Sold out in the fall window for zone 6 → reserve with the fall deadline.
    const reserve = resolveShippableMode(on(9, 20), withDeadlines, 6, { soldOut: true });
    expect(reserve.mode).toBe("bareroot-preorder");
    expect(reserve.orderDeadline).toEqual([11, 21]);
    // Peat & bagged has no deadline.
    expect(resolveShippableMode(on(6, 15), withDeadlines, 6).orderDeadline).toBeNull();
  });
});

describe("customer-facing copy (GOL-2233 flat $10 per order; no em dashes)", () => {
  const reserveSoldOut = soldOutOn(8, 20); // sold out, before cutover → sold-out reserve
  const reserveOffSeason = resolveShippableMode(on(11, 15), CAL); // after cutover → off-season
  const inWindow = resolveShippableMode(on(10, 1), CAL); // in stock, ships now
  const peat = resolveShippableMode(on(6, 15), CAL); // peat & bagged

  it("badge: reserve → Reserve, peat → Peat & bagged, ships-now → unbadged", () => {
    expect(barerootBadge(reserveSoldOut)).toBe("Reserve");
    expect(barerootBadge(reserveOffSeason)).toBe("Reserve");
    expect(barerootBadge(peat)).toBe("Peat & bagged");
    expect(barerootBadge(inWindow)).toBeNull();
  });

  it("compact timing states the flat reserve, ships-now + charged in full, or the SLA", () => {
    expect(barerootTimingShort(reserveSoldOut)).toBe("$10 to reserve · ships this fall");
    expect(barerootTimingShort(inWindow)).toBe("Ships now · charged in full");
    expect(barerootTimingShort(peat)).toBe("Ships in 5–10 business days");
  });

  it("reserve note splits on the deposit reason and states a flat $10 per order", () => {
    expect(barerootNote(reserveSoldOut)).toBe(
      "This size is sold out for now. Reserve your whole order with a flat $10 deposit and we charge the balance when your trees ship this fall, timed to your area.",
    );
    expect(barerootNote(reserveOffSeason)).toContain("Bareroot planting season is closed for now.");
    expect(barerootNote(reserveOffSeason)).toContain("flat $10 deposit");
  });

  it("ships-now note says charged in full today", () => {
    expect(barerootNote(inWindow)).toContain("charged in full today");
  });

  it("never uses an em dash and never says a per-tree deposit", () => {
    for (const r of [reserveSoldOut, reserveOffSeason, inWindow, peat]) {
      const note = barerootNote(r);
      expect(note).not.toContain("—"); // brand rule: no em dashes
      expect(note).not.toContain("per tree"); // GOL-2233: flat $10 per ORDER
    }
  });
});

describe("advisory copy helpers", () => {
  it("formatMonthDay matches the backend _fmt (locale-free)", () => {
    expect(formatMonthDay([11, 21])).toBe("Nov 21");
    expect(formatMonthDay([5, 5])).toBe("May 5");
  });

  it("orderDeadlineLine renders for a reserve, null for peat / no deadline", () => {
    const withDeadline: ShippingCalendar = {
      ...CAL,
      zones: { "6": { ...CAL.zones["6"], fall_order_deadline: [11, 21] } },
    };
    const reserve = resolveShippableMode(on(9, 20), withDeadline, 6, { soldOut: true });
    expect(orderDeadlineLine(reserve)).toBe("Order by Nov 21");
    expect(orderDeadlineLine(resolveShippableMode(on(6, 15), withDeadline, 6))).toBeNull();
  });
});

describe("tierFulfillment — one presentation authority", () => {
  const reserve = resolveShippableMode(on(8, 20), CAL, null, { soldOut: true }); // sold-out reserve
  const peat = resolveShippableMode(on(6, 15), CAL); // peat & bagged
  it("pickup-only → pickup line, no badge, keeps the label, regardless of tier", () => {
    expect(
      tierFulfillment({
        tier: "potted",
        label: "Potted",
        pickupOnly: true,
        pickupFulfillment: "Farm pickup only",
        hintFulfillment: "Ships now",
        shipMode: reserve,
      }),
    ).toEqual({ label: "Potted", fulfillment: "Farm pickup only", badge: null });
  });
  it("bareroot with a live reserve mode → flat-$10 timing + Reserve badge", () => {
    expect(
      tierFulfillment({
        tier: "bareroot",
        label: "Bareroot",
        pickupOnly: false,
        pickupFulfillment: "Farm pickup only",
        hintFulfillment: "Reserve for October",
        shipMode: reserve,
      }),
    ).toEqual({ label: "Bareroot", fulfillment: "$10 to reserve · ships this fall", badge: "Reserve" });
  });
  it("bareroot in the leafed window → the option IS named Peat & bagged, no badge", () => {
    expect(
      tierFulfillment({
        tier: "bareroot",
        label: "Bareroot",
        pickupOnly: false,
        pickupFulfillment: "Farm pickup only",
        hintFulfillment: "Ships now",
        shipMode: peat,
      }),
    ).toEqual({ label: "Peat & bagged", fulfillment: "Ships in 5–10 business days", badge: null });
  });
  it("no live mode (legacy backend) → static hint, no badge, keeps the label", () => {
    expect(
      tierFulfillment({
        tier: "bareroot",
        label: "Bareroot",
        pickupOnly: false,
        pickupFulfillment: "Farm pickup only",
        hintFulfillment: "Reserve for October",
        shipMode: null,
      }),
    ).toEqual({ label: "Bareroot", fulfillment: "Reserve for October", badge: null });
  });
});

describe("monthDayOf — timezone-stable extraction", () => {
  it("reads the UTC month/day", () => {
    expect(monthDayOf(new Date(Date.UTC(2026, 7, 15)))).toEqual([8, 15]);
    expect(monthDayOf(new Date(Date.UTC(2026, 0, 1)))).toEqual([1, 1]);
  });
});

describe("zoneShipNote — homepage Field Notes row", () => {
  const Z: ShippingCalendar = {
    ...CAL,
    zones: {
      "3": {
        fall: [[11, 2], [11, 13]],
        spring: [[4, 8], [4, 15]],
        fall_order_deadline: [11, 12],
        spring_order_deadline: [4, 1],
      },
    },
  };

  it("before the fall window: shows the zone's fall window + order-by", () => {
    expect(zoneShipNote(on(9, 23), Z, 3)).toEqual({
      label: "Ships Nov 2 – Nov 13",
      note: "Order by Nov 12",
    });
  });

  it("inside the fall window: still the fall window", () => {
    expect(zoneShipNote(on(11, 5), Z, 3).label).toBe("Ships Nov 2 – Nov 13");
  });

  it("past the fall window: rolls to next spring", () => {
    expect(zoneShipNote(on(12, 1), Z, 3)).toEqual({
      label: "Ships Apr 8 – Apr 15",
      note: "Order by Apr 1",
    });
  });

  it("before the spring window ends: shows spring", () => {
    expect(zoneShipNote(on(3, 1), Z, 3).label).toBe("Ships Apr 8 – Apr 15");
  });

  it("unknown zone: no invented dates", () => {
    expect(zoneShipNote(on(9, 23), Z, 9)).toEqual({ label: "Confirmed at checkout", note: null });
  });
});

// ── Ship-window envelope for zone-agnostic copy (GOL-2948) ───────────────────
//
// VERBATIM mirror of the `calendar` block of the live prod feed
// (GET https://odoo.gatheringatthegrove.com/grove/api/v1/shipping/rates, read
// 2026-10-05), transcribed from the response rather than hand-typed. The whole
// point of GOL-2948 is that the policy page's ship window was hand-written and
// matched no zone in this data, so the fixture has to be the real thing.
const PROD_CAL: ShippingCalendar = {
  // GOL-2957: `[min, max]` USDA hardiness span the green list covers, derived
  // backend-side from the green-filtered PHZM matrix. Pinned to [3, 10] by
  // grove_headless's own `test_served_usda_range_is_derived_green_list_span`,
  // so this mirrors the serializer contract rather than a hand-picked band.
  served_usda_range: [3, 10],
  preorder_open: { fall: [10, 16], spring: [11, 1] },
  leafed_window: [[5, 1], [10, 15]],
  fulfillment_days: [5, 10],
  approximate: true,
  weather_hold_note: null,
  zones: {
    "2": {
      fall: [[11, 2], [11, 13]],
      spring: [[4, 19], [6, 6]],
      fall_order_deadline: [11, 12],
      spring_order_deadline: [5, 31],
    },
    "3": {
      fall: [[11, 2], [11, 13]],
      spring: [[4, 19], [6, 6]],
      fall_order_deadline: [11, 12],
      spring_order_deadline: [5, 31],
    },
    "4": {
      fall: [[11, 2], [11, 19]],
      spring: [[4, 19], [6, 6]],
      fall_order_deadline: [11, 16],
      spring_order_deadline: [5, 31],
    },
    "5": {
      fall: [[11, 2], [11, 19]],
      spring: [[4, 12], [6, 6]],
      fall_order_deadline: [11, 16],
      spring_order_deadline: [5, 31],
    },
    "6": {
      fall: [[11, 9], [11, 26]],
      spring: [[4, 5], [6, 6]],
      fall_order_deadline: [11, 21],
      spring_order_deadline: [5, 31],
    },
    "7": {
      fall: [[11, 9], [11, 26]],
      spring: [[3, 16], [5, 24]],
      fall_order_deadline: [11, 21],
      spring_order_deadline: [5, 17],
    },
    "8": {
      fall: [[11, 9], [12, 12]],
      spring: [[3, 1], [4, 30]],
      fall_order_deadline: [11, 21],
      spring_order_deadline: [4, 16],
    },
    "9": {
      fall: [[11, 9], [12, 12]],
      spring: [[3, 1], [4, 30]],
      fall_order_deadline: [11, 21],
      spring_order_deadline: [4, 16],
    },
    "10": {
      fall: [[11, 9], [12, 12]],
      spring: [[3, 1], [4, 30]],
      fall_order_deadline: [11, 21],
      spring_order_deadline: [4, 16],
    },
  },
};

describe("shipWindowEnvelope", () => {
  it("unions every served zone, not just the temperate middle", () => {
    const env = shipWindowEnvelope(PROD_CAL);
    expect(env.source).toBe("feed");
    // Earliest fall start is zones 2-5 (Nov 2); latest fall end is zones 8-10
    // (Dec 12). Earliest spring start is zones 8-10 (Mar 1); latest spring end
    // is zones 2-6 (Jun 6). Dropping the warm zones would hide real ship dates
    // from the green states in them (FL, LA, coastal GA/AL/MS/SC).
    expect(formatWindow(env.fall)).toBe("Nov 2 – Dec 12");
    expect(formatWindow(env.spring)).toBe("Mar 1 – Jun 6");
  });

  it("names no month the engine ships nothing in", () => {
    const env = shipWindowEnvelope(PROD_CAL);
    const shown = [...monthsCovered(env.fall), ...monthsCovered(env.spring)];
    const shippable = new Set(
      Object.values(PROD_CAL.zones).flatMap((z) => [
        ...monthsCovered(z.fall),
        ...monthsCovered(z.spring),
      ]),
    );
    for (const month of shown) expect(shippable.has(month)).toBe(true);
    // The specific regression: the old literal said "Feb - May". February is
    // not in any zone's window, and November/December/June were all missing.
    expect(shown).not.toContain(2);
    expect(shown).toEqual(expect.arrayContaining([11, 12, 3, 6]));
  });

  it("is derived, not baked: a narrower calendar narrows the copy", () => {
    const onlyWarm: ShippingCalendar = {
      ...PROD_CAL,
      zones: { "7": PROD_CAL.zones["7"] },
    };
    const env = shipWindowEnvelope(onlyWarm);
    expect(formatWindow(env.fall)).toBe("Nov 9 – Nov 26");
    expect(formatWindow(env.spring)).toBe("Mar 16 – May 24");
  });

  it("degrades to the baked backend mirror, never to a literal", () => {
    for (const degraded of [null, undefined, { ...PROD_CAL, zones: {} }]) {
      const env = shipWindowEnvelope(degraded as ShippingCalendar | null);
      expect(env.source).toBe("snapshot");
      expect(env.fall).toEqual(DEFAULT_WINDOWS.fall);
      expect(env.spring).toEqual(DEFAULT_WINDOWS.spring);
    }
  });

  it("the baked snapshot agrees with the live feed's envelope", () => {
    // Keeps the degraded policy page and the live one telling the same story.
    // If the backend re-schedules a wave, this fails and the mirror gets bumped
    // (same contract as the DEFAULT_WINDOWS note above).
    const live = shipWindowEnvelope(PROD_CAL);
    expect(live.fall).toEqual(DEFAULT_WINDOWS.fall);
    expect(live.spring).toEqual(DEFAULT_WINDOWS.spring);
  });

  it("skips a malformed zone instead of throwing", () => {
    const partial = {
      ...PROD_CAL,
      zones: { "5": PROD_CAL.zones["5"], "6": {} as never },
    };
    expect(formatWindow(shipWindowEnvelope(partial).fall)).toBe("Nov 2 – Nov 19");
  });
});

describe("servedZoneSpan — GOL-2967 served USDA hardiness span", () => {
  it("reads the derived span off the feed", () => {
    // The page prints these two numbers and nothing else, so a green-list
    // change (which reshapes the backend matrix) reshapes the copy.
    expect(servedZoneSpan(PROD_CAL)).toEqual([3, 10]);
  });

  it("is derived, not a band baked into the frontend", () => {
    // Proves AC2 the only way a unit test can: feed a DIFFERENT span and the
    // output follows it. If anyone re-hardcodes "5-7" (or 3-10) here, this
    // fails. Narrower AND wider, so a clamp would not sneak through either.
    expect(servedZoneSpan({ ...PROD_CAL, served_usda_range: [5, 7] })).toEqual([
      5, 7,
    ]);
    expect(servedZoneSpan({ ...PROD_CAL, served_usda_range: [2, 11] })).toEqual([
      2, 11,
    ]);
    expect(servedZoneSpan({ ...PROD_CAL, served_usda_range: [6, 6] })).toEqual([
      6, 6,
    ]);
  });

  it("returns null for a degraded or pre-GOL-2957 feed", () => {
    // Prod runs a grove_headless without the key until GOL-3014 deploys, and
    // the page is force-dynamic — so this is the LIVE branch today, not an
    // edge case. The policy page drops the parenthetical; it must never fall
    // back to a literal band the way the ship window falls back to a snapshot.
    const { served_usda_range: _omitted, ...withoutKey } = PROD_CAL;
    expect(servedZoneSpan(withoutKey as ShippingCalendar)).toBeNull();
    expect(servedZoneSpan(null)).toBeNull();
    expect(servedZoneSpan(undefined)).toBeNull();
    expect(
      servedZoneSpan({ ...PROD_CAL, served_usda_range: null }),
    ).toBeNull();
  });

  it("refuses a malformed span instead of rendering half a range", () => {
    // The feed is untrusted JSON at runtime. Each of these would otherwise
    // print something like "USDA Zones –" or "USDA Zones 3–undefined" on a
    // board-approved policy page.
    for (const bad of [
      [null, null],
      [3],
      [],
      [3, 10, 11],
      ["3", "10"],
      [3, null],
      [3.5, 10],
      [NaN, 10],
      [10, 3],
      3,
      "3-10",
      {},
    ]) {
      expect(
        servedZoneSpan({
          ...PROD_CAL,
          served_usda_range: bad as never,
        }),
      ).toBeNull();
    }
  });
});
