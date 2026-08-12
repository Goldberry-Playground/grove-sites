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
  PREORDER_DEPOSIT_PCT,
  type ShippableMode,
} from "./fulfillment-mode";

// GOL-1114 — three-mode fulfillment resolver. Boundaries here are the doc §2
// defaults (fall ship Sep 15 → Oct 30; spring Jan 1 → May 5; preorder switches
// Aug 15 / Nov 1), expressed in the canonical schema-2 ShippingCalendar shape the
// backend serves (GOL-1172/1177). These tests pin the *logic* to the ratified
// timeline, so a calendar edit only changes fixtures, never the state machine.

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
const modeOn = (month: number, day: number): ShippableMode =>
  resolveShippableMode(on(month, day), CAL).mode;

describe("resolveShippableMode — the ratified timeline (doc §2)", () => {
  it("Jan 1 → May 5: spring bareroot ships now (in the zone window)", () => {
    for (const [m, d] of [[1, 1], [2, 14], [3, 20], [5, 5]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
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
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.mode).toBe("bareroot-preorder");
      expect(r.depositNow).toBe(true);
      expect(r.preorderSeason).toBe("fall");
    }
  });

  it("Sep 15 → Oct 30: fall bareroot ships now (in the zone window)", () => {
    for (const [m, d] of [[9, 15], [10, 1], [10, 30]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
      expect(r.mode).toBe("bareroot-in-window");
      expect(r.depositNow).toBe(false);
    }
  });

  it("Nov 1 → Dec 31: spring bareroot PREORDER, deposit taken now", () => {
    for (const [m, d] of [[11, 1], [12, 1], [12, 31]] as const) {
      const r = resolveShippableMode(on(m, d), CAL);
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
    const r = resolveShippableMode(on(10, 31), CAL);
    expect(r.mode).toBe("peat-and-bagged");
    expect(r.depositNow).toBe(false);
    expect(r.preorderSeason).toBeNull();
  });

  it("every day of the year resolves to exactly one mode, with no dead months", () => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const seen = new Set<ShippableMode>();
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth[m - 1]; d++) {
        const r = resolveShippableMode(on(m, d), CAL);
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
  // logic reads the passed zone's calendar rather than hardcoding a season.
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

  it("Sep 20 is fall preorder for the later zone (its window has not opened yet)", () => {
    const r = resolveShippableMode(on(9, 20), STAGGERED, laterZone);
    expect(r.mode).toBe("bareroot-preorder");
    expect(r.preorderSeason).toBe("fall");
  });

  it("Sep 20 is ships-now for the earlier zone 6 (its window is already open)", () => {
    expect(resolveShippableMode(on(9, 20), STAGGERED, 6).mode).toBe("bareroot-in-window");
  });

  it("zone unknown, zones DISAGREE → conservative preorder, never over-promise ships-now (GOL-1313 finding 3)", () => {
    // Sep 20: zone 6 is in its fall window (ships now) but zone 3's window has
    // not opened (still preorder). The old union asserted "Ships now" for the
    // season — a deposit-shape surprise for a zone-3 shopper at checkout. The
    // conservative aggregate shows the preorder (deposit) framing instead: the
    // only shopper it "surprises" is one whose zone actually ships now, and only
    // by charging sooner, never later.
    const r = resolveShippableMode(on(9, 20), STAGGERED);
    expect(r.mode).toBe("bareroot-preorder");
    expect(r.depositNow).toBe(true);
    expect(r.preorderSeason).toBe("fall");
  });

  it("zone unknown, zones AGREE ships-now → honest ships-now", () => {
    // Oct 15: both zone 6 (Sep 15–Oct 30) and zone 3 (Oct 1–Oct 30) are in
    // window, so no zone is on preorder and "Ships now" is honest.
    expect(resolveShippableMode(on(10, 15), STAGGERED).mode).toBe("bareroot-in-window");
  });
});

describe("GOL-1313 — crash safety, backend-mirror fallback, advisory fields", () => {
  it("a calendar missing preorder_open never throws → peat & bagged (finding 1)", () => {
    // A degraded / hand-crafted feed. The resolver reads preorder_open
    // defensively: the preorder branches are skipped, the date falls through to
    // the ships-now peat & bagged policy rather than dereferencing undefined.
    const partial = { ...CAL, preorder_open: undefined } as unknown as ShippingCalendar;
    expect(() => resolveShippableMode(on(8, 20), partial)).not.toThrow();
    expect(resolveShippableMode(on(8, 20), partial).mode).toBe("peat-and-bagged");
  });

  it("empty-zones fallback uses backend-mirror windows, not the old Sep 15 / Jan 1 (finding 2)", () => {
    // No zones at all → DEFAULT_WINDOWS (backend WAVE_SCHEDULE union: fall Nov 2–
    // Dec 12, spring Mar 1–Jun 6). Mid-January must NOT read as ships-now (the old
    // spring Jan 1 default promised shipping through hard-freeze January).
    const noZones = { ...CAL, zones: {} } as ShippingCalendar;
    expect(resolveShippableMode(on(1, 15), noZones).mode).toBe("bareroot-preorder");
    expect(resolveShippableMode(on(11, 15), noZones).mode).toBe("bareroot-in-window"); // in fall window
    expect(resolveShippableMode(on(4, 1), noZones).mode).toBe("bareroot-in-window"); // in spring window
  });

  it("surfaces approximate + weather_hold_note from the feed (finding 5)", () => {
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

  it("known zone surfaces its per-season order deadline; unknown zone / peat does not", () => {
    const withDeadlines: ShippingCalendar = {
      ...CAL,
      zones: {
        "6": {
          ...CAL.zones["6"],
          fall_order_deadline: [11, 21],
          spring_order_deadline: [5, 31],
        },
      },
    };
    // Spring preorder for zone 6 (Dec 1 → spring window opens Jan 1 the next year;
    // use a date in the spring preorder wrap): Nov 15 is spring preorder.
    const springPre = resolveShippableMode(on(11, 15), withDeadlines, 6);
    expect(springPre.mode).toBe("bareroot-preorder");
    expect(springPre.orderDeadline).toEqual([5, 31]);
    // Peat & bagged has no deadline.
    expect(resolveShippableMode(on(6, 15), withDeadlines, 6).orderDeadline).toBeNull();
    // Unknown zone never asserts a per-zone deadline.
    expect(resolveShippableMode(on(11, 15), withDeadlines).orderDeadline).toBeNull();
  });
});

describe("customer-facing copy (GOL-1173 ratified; 25% deposit, no em dashes)", () => {
  const preorder = resolveShippableMode(on(8, 20), CAL); // fall preorder
  const inWindow = resolveShippableMode(on(10, 1), CAL); // ships now
  const peat = resolveShippableMode(on(6, 15), CAL); // peat & bagged

  it("badge names preorder / peat, and leaves in-window unbadged", () => {
    expect(barerootBadge(preorder)).toBe("Preorder");
    expect(barerootBadge(peat)).toBe("Peat & bagged");
    expect(barerootBadge(inWindow)).toBeNull();
  });

  it("compact timing states the deposit %, ships-now, or the SLA", () => {
    expect(barerootTimingShort(preorder)).toBe("25% deposit · ships this fall");
    expect(barerootTimingShort(inWindow)).toBe("Ships now");
    expect(barerootTimingShort(peat)).toBe("Ships in 5–10 business days");
  });

  it("preorder note is the ratified copy and never uses an em dash", () => {
    const note = barerootNote(preorder);
    expect(note).toBe(
      `Reserve now with a ${PREORDER_DEPOSIT_PCT}% deposit. We charge the rest when your tree ships this fall, timed to your area.`,
    );
    for (const note of [barerootNote(preorder), barerootNote(inWindow), barerootNote(peat)]) {
      expect(note).not.toContain("—"); // brand rule: no em dashes
    }
  });
});

describe("advisory copy helpers (GOL-1313 finding 5)", () => {
  it("formatMonthDay matches the backend _fmt (locale-free)", () => {
    expect(formatMonthDay([11, 21])).toBe("Nov 21");
    expect(formatMonthDay([5, 5])).toBe("May 5");
  });

  it("orderDeadlineLine renders for a bareroot wave, null for peat / no deadline", () => {
    const withDeadline: ShippingCalendar = {
      ...CAL,
      zones: { "6": { ...CAL.zones["6"], spring_order_deadline: [5, 31] } },
    };
    const springPre = resolveShippableMode(on(11, 15), withDeadline, 6);
    expect(orderDeadlineLine(springPre)).toBe("Order by May 31");
    expect(orderDeadlineLine(resolveShippableMode(on(6, 15), withDeadline, 6))).toBeNull();
  });
});

describe("monthDayOf — timezone-stable extraction", () => {
  it("reads the UTC month/day", () => {
    expect(monthDayOf(new Date(Date.UTC(2026, 7, 15)))).toEqual([8, 15]);
    expect(monthDayOf(new Date(Date.UTC(2026, 0, 1)))).toEqual([1, 1]);
  });
});
