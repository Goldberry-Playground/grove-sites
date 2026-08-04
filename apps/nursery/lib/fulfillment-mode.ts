/**
 * Three-mode shippable-fulfillment resolver (GOL-1114).
 *
 * Pure `date + zone-calendar → shippable mode` state machine for the finalized
 * Box Engine fulfillment model (issue doc `box-fulfillment-model` rev 2, ratified
 * by Josh 2026-08-04). A shippable tree shows EXACTLY ONE mode at a time; the
 * mode is decided by the date and the shopper's USDA-hardiness-zone calendar.
 *
 * ── Ownership boundary ──────────────────────────────────────────────────────
 * This module owns only the *logic* (which of the three modes applies on a given
 * date). The window BOUNDARIES are backend data owned by GOL-1172: a per-USDA-
 * zone, annually-editable calendar that replaces the single global
 * `dormant_window` in the schema-2 feed. {@link ZoneShippingCalendar} is the
 * stable client-side shape this resolver reads; only its numbers change per zone
 * and per year. Keeping the values out of here means a calendar edit is a data
 * change, never a code change — and this resolver never needs to be rebuilt for
 * a new season.
 *
 * Potted is out of scope here: potted is farm-pickup-only always (no shippable
 * box by design — see `isPickupOnly` in `shipping-estimate.ts`). This resolver
 * is only asked about a SHIPPABLE (bareroot-capable) product.
 *
 * The calendar a single shippable tree walks through (doc §2):
 *   Jan 1  → May 5   spring bareroot ships now      (in the zone's spring window)
 *   May 6  → Aug 14  peat & bagged (leafed)         (5–10 business days)
 *   Aug 15 → Sep 14  fall bareroot PREORDER          (deposit now; ships fall)
 *   Sep 15 → Oct 30  fall bareroot ships now         (in the zone's fall window)
 *   Oct 31           past the fall window            → peat & bagged fallback
 *   Nov 1  → Dec 31  spring bareroot PREORDER         (deposit now; ships spring)
 * (default fall window ~Sep 15 → Oct 30; spring Jan 1 → May 5 — staggered per
 *  zone by GOL-1172. Global preorder switches: fall Aug 15, spring Nov 1.)
 */

/** The shippable mode a bareroot-capable tree shows on a given date/zone. */
export type ShippableMode =
  | "bareroot-preorder" // deposit taken now; ships in the zone's next window
  | "bareroot-in-window" // dormant; ships now, inside the zone's window
  | "peat-and-bagged"; // leafed; 4/box; normal 5–10 business-day processing

/** A `[month, day]` pair, month 1-based — mirrors the feed's `dormant_window`
 *  wire shape so the backend calendar (GOL-1172) drops in unchanged. */
export type MonthDay = [number, number];

/**
 * Per-USDA-zone shipping calendar. VALUES are owned by the backend (GOL-1172):
 * a per-zone, annually-editable calendar. This is only the client-side *shape*
 * the resolver reads. Defaults documented for reference; the live feed supplies
 * the real per-zone numbers.
 */
export interface ZoneShippingCalendar {
  /** Global fall preorder-open switch. Default `[8, 15]` (Aug 15). */
  fallPreorderOpen: MonthDay;
  /** This zone's fall bareroot ship window. Default `[[9, 15], [10, 30]]`. */
  fallShipWindow: [MonthDay, MonthDay];
  /** Global spring preorder-open switch. Default `[11, 1]` (Nov 1). */
  springPreorderOpen: MonthDay;
  /** This zone's spring bareroot ship window. Default `[[1, 1], [5, 5]]`. */
  springShipWindow: [MonthDay, MonthDay];
}

/** Reference default calendar (doc §2). The backend feed overrides this per zone
 *  — never hardcode a season in a component; read the zone's calendar. */
export const DEFAULT_ZONE_CALENDAR: ZoneShippingCalendar = {
  fallPreorderOpen: [8, 15],
  fallShipWindow: [
    [9, 15],
    [10, 30],
  ],
  springPreorderOpen: [11, 1],
  springShipWindow: [
    [1, 1],
    [5, 5],
  ],
};

export interface FulfillmentResolution {
  mode: ShippableMode;
  /** True only for `bareroot-preorder` — a deposit is taken now (amount owned by
   *  Finance/CMO, GOL-1173). The label/checkout layer reads this flag. */
  depositNow: boolean;
  /** Which seasonal window a preorder will ship in, else `null`. Drives the
   *  "ships in your <season> window" timing line; exact copy owned by GOL-1173. */
  preorderSeason: "fall" | "spring" | null;
}

/** Monotonic within-year key for a `[month, day]`: `0101`..`1231`. Calendar
 *  granularity is day-level and leap-day-agnostic (the backend owns exact ship
 *  weeks); this ordering is all the mode boundaries need. */
function ord(md: MonthDay): number {
  return md[0] * 100 + md[1];
}

/** Extract a `[month, day]` from a Date in UTC, so a caller's timezone can never
 *  shift which mode a shopper sees near a midnight boundary. */
export function monthDayOf(date: Date): MonthDay {
  return [date.getUTCMonth() + 1, date.getUTCDate()];
}

/** Inclusive `[start, end]` membership within a single calendar year (no wrap —
 *  all four default windows are within-year). */
function inWindow(d: number, window: [MonthDay, MonthDay]): boolean {
  return d >= ord(window[0]) && d <= ord(window[1]);
}

/**
 * Resolve the single shippable mode for `date` under a zone's `calendar`.
 *
 * Priority mirrors the doc timeline: an in-window ("ships now") state wins over
 * a preorder state, and anything not claimed by a bareroot cycle falls through
 * to peat & bagged. That fall-through is deliberate — it covers both the
 * summer leafed window (May 6 → Aug 14) AND the post-window gap (Oct 31, after
 * the fall window has shipped but before spring preorder opens), which is Josh's
 * "shipped-past-your-zone → normal 5–10 business-day fallback, never held as
 * preorder" rule (doc §2 edge case). So there are never dead months.
 */
export function resolveShippableMode(
  date: Date,
  calendar: ZoneShippingCalendar = DEFAULT_ZONE_CALENDAR,
): FulfillmentResolution {
  const d = ord(monthDayOf(date));

  // 1. In a bareroot ship window → ships now (wins over any preorder).
  if (inWindow(d, calendar.springShipWindow)) {
    return { mode: "bareroot-in-window", depositNow: false, preorderSeason: null };
  }
  if (inWindow(d, calendar.fallShipWindow)) {
    return { mode: "bareroot-in-window", depositNow: false, preorderSeason: null };
  }

  // 2. Fall preorder: from the Aug 15 switch up to (not into) the fall window.
  if (d >= ord(calendar.fallPreorderOpen) && d < ord(calendar.fallShipWindow[0])) {
    return { mode: "bareroot-preorder", depositNow: true, preorderSeason: "fall" };
  }

  // 3. Spring preorder: from the Nov 1 switch through year-end, then into Jan up
  //    to (not into) the spring window. springPreorderOpen (Nov) > springShip
  //    start (Jan), so the window wraps the year boundary.
  const inSpringPreorder =
    d >= ord(calendar.springPreorderOpen) || d < ord(calendar.springShipWindow[0]);
  if (inSpringPreorder) {
    return { mode: "bareroot-preorder", depositNow: true, preorderSeason: "spring" };
  }

  // 4. Everything else (summer leafed window + post-fall-window gap) → peat &
  //    bagged, the no-dead-months fallback on the normal 5–10 business-day policy.
  return { mode: "peat-and-bagged", depositNow: false, preorderSeason: null };
}
