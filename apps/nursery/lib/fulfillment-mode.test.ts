import { describe, it, expect } from "vitest";
import {
  resolveShippableMode,
  monthDayOf,
  DEFAULT_ZONE_CALENDAR,
  type ShippableMode,
  type ZoneShippingCalendar,
} from "./fulfillment-mode";

// GOL-1114 — three-mode fulfillment resolver. Boundaries here are the doc §2
// defaults (fall ship ~Sep 15 → Oct 30; spring Jan 1 → May 5; preorder switches
// Aug 15 / Nov 1). The per-zone real numbers come from the backend (GOL-1172);
// these tests pin the *logic* to the ratified timeline, so a calendar edit only
// changes fixtures, never the state machine.

/** Build a UTC date from a [month, day] so no local-timezone offset can shift
 *  which mode a boundary date resolves to. */
const on = (month: number, day: number) => new Date(Date.UTC(2026, month - 1, day));
const modeOn = (month: number, day: number): ShippableMode =>
  resolveShippableMode(on(month, day)).mode;

describe("resolveShippableMode — the ratified timeline (doc §2)", () => {
  it("Jan 1 → May 5: spring bareroot ships now (in the zone window)", () => {
    for (const [m, d] of [[1, 1], [2, 14], [3, 20], [5, 5]] as const) {
      const r = resolveShippableMode(on(m, d));
      expect(r.mode).toBe("bareroot-in-window");
      expect(r.depositNow).toBe(false);
      expect(r.preorderSeason).toBeNull();
    }
  });

  it("May 6 → Aug 14: peat & bagged (leafed, 5–10 business days)", () => {
    for (const [m, d] of [[5, 6], [6, 15], [7, 4], [8, 14]] as const) {
      expect(modeOn(m, d)).toBe("peat-and-bagged");
    }
  });

  it("Aug 15 → Sep 14: fall bareroot PREORDER, deposit taken now", () => {
    for (const [m, d] of [[8, 15], [8, 31], [9, 14]] as const) {
      const r = resolveShippableMode(on(m, d));
      expect(r.mode).toBe("bareroot-preorder");
      expect(r.depositNow).toBe(true);
      expect(r.preorderSeason).toBe("fall");
    }
  });

  it("Sep 15 → Oct 30: fall bareroot ships now (in the zone window)", () => {
    for (const [m, d] of [[9, 15], [10, 1], [10, 30]] as const) {
      const r = resolveShippableMode(on(m, d));
      expect(r.mode).toBe("bareroot-in-window");
      expect(r.depositNow).toBe(false);
    }
  });

  it("Nov 1 → Dec 31: spring bareroot PREORDER, deposit taken now", () => {
    for (const [m, d] of [[11, 1], [12, 1], [12, 31]] as const) {
      const r = resolveShippableMode(on(m, d));
      expect(r.mode).toBe("bareroot-preorder");
      expect(r.depositNow).toBe(true);
      expect(r.preorderSeason).toBe("spring");
    }
  });
});

describe("resolveShippableMode — Josh's edge cases (no dead months)", () => {
  it("Oct 31 gap (fall shipped, spring preorder not yet open) → peat & bagged, NOT held as preorder", () => {
    // Josh: an order after the zone window has shipped falls back to normal
    // 5–10 business-day processing, never held as a preorder.
    const r = resolveShippableMode(on(10, 31));
    expect(r.mode).toBe("peat-and-bagged");
    expect(r.depositNow).toBe(false);
    expect(r.preorderSeason).toBeNull();
  });

  it("every day of the year resolves to exactly one mode, with no dead months", () => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const seen = new Set<ShippableMode>();
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth[m - 1]; d++) {
        const r = resolveShippableMode(on(m, d));
        expect(["bareroot-preorder", "bareroot-in-window", "peat-and-bagged"]).toContain(r.mode);
        // deposit is taken exactly when (and only when) it's a preorder
        expect(r.depositNow).toBe(r.mode === "bareroot-preorder");
        // a preorder always names the season it will ship in; nothing else does
        expect(r.preorderSeason !== null).toBe(r.mode === "bareroot-preorder");
        seen.add(r.mode);
      }
    }
    // all three modes are reachable across the year — none is dead code
    expect(seen).toEqual(new Set(["bareroot-preorder", "bareroot-in-window", "peat-and-bagged"]));
  });

  it("boundary days switch cleanly (no off-by-one overlap or gap)", () => {
    expect(modeOn(5, 5)).toBe("bareroot-in-window"); // last spring ship day
    expect(modeOn(5, 6)).toBe("peat-and-bagged"); // first leafed day
    expect(modeOn(8, 14)).toBe("peat-and-bagged"); // last leafed day
    expect(modeOn(8, 15)).toBe("bareroot-preorder"); // fall preorder opens
    expect(modeOn(9, 14)).toBe("bareroot-preorder"); // last fall preorder day
    expect(modeOn(9, 15)).toBe("bareroot-in-window"); // fall window opens
    expect(modeOn(10, 30)).toBe("bareroot-in-window"); // last fall ship day
    expect(modeOn(10, 31)).toBe("peat-and-bagged"); // post-window fallback
    expect(modeOn(11, 1)).toBe("bareroot-preorder"); // spring preorder opens
  });
});

describe("zone staggering — a later zone's ship window shifts the boundaries", () => {
  // A colder/farther zone ships later: fall window Oct 1 → Oct 30 instead of
  // Sep 15. Preorder should then extend to cover the later start, proving the
  // logic reads the calendar rather than hardcoding a season.
  const laterZone: ZoneShippingCalendar = {
    ...DEFAULT_ZONE_CALENDAR,
    fallShipWindow: [
      [10, 1],
      [10, 30],
    ],
  };

  it("Sep 20 is fall preorder for a later zone (its window has not opened yet)", () => {
    const r = resolveShippableMode(on(9, 20), laterZone);
    expect(r.mode).toBe("bareroot-preorder");
    expect(r.preorderSeason).toBe("fall");
  });

  it("Sep 20 is ships-now for the default zone (its window is already open)", () => {
    expect(resolveShippableMode(on(9, 20), DEFAULT_ZONE_CALENDAR).mode).toBe(
      "bareroot-in-window",
    );
  });
});

describe("monthDayOf — timezone-stable extraction", () => {
  it("reads the UTC month/day", () => {
    expect(monthDayOf(new Date(Date.UTC(2026, 7, 15)))).toEqual([8, 15]);
    expect(monthDayOf(new Date(Date.UTC(2026, 0, 1)))).toEqual([1, 1]);
  });
});
