import type {
  ShippableMode,
  ShippingCalendar,
  ShippingCalendarZone,
  MonthDay,
} from "@grove/odoo-client";

/**
 * Three-mode shippable-fulfillment resolver + label copy (GOL-1114).
 *
 * Pure `date + zone-calendar → shippable mode` state machine for the finalized
 * Box Engine fulfillment model (issue doc `box-fulfillment-model` rev 2, ratified
 * by Josh 2026-08-04). A shippable (bareroot-capable) tree shows EXACTLY ONE mode
 * at a time; the mode is decided by today's date against the schema-2 feed's
 * per-USDA-zone shipping calendar (GOL-1172/1177, both landed).
 *
 * ── Ownership boundary ──────────────────────────────────────────────────────
 * This module owns only the *logic* (which of the three modes applies) and the
 * ratified customer *copy*. The window BOUNDARIES are backend data: the
 * {@link ShippingCalendar} block of the schema-2 rate feed — a per-USDA-zone,
 * annually-editable calendar that replaced the single global `dormant_window`.
 * A calendar edit is therefore a data change, never a code change here, and this
 * resolver never needs rebuilding for a new season.
 *
 * The customer-facing wording (flat $10 deposit, preorder sublines) is the
 * ratified GOL-1302 copy (Josh, 2026-08-12), which supersedes the earlier 25%
 * GOL-1173 wording.
 *
 * Potted is out of scope: potted is farm-pickup-only always (no shippable box by
 * design — see `isPickupOnly` in `shipping-estimate.ts`). Only ask this resolver
 * about a bareroot-capable product.
 *
 * The calendar a single shippable tree walks through (doc §2):
 *   Jan 1  → May 5   spring bareroot ships now      (in the zone's spring window)
 *   May 6  → Aug 14  peat & bagged (leafed)         (5–10 business days)
 *   Aug 15 → Sep 14  fall bareroot PREORDER          (deposit now; ships fall)
 *   Sep 15 → Oct 30  fall bareroot ships now         (in the zone's fall window)
 *   Oct 31           past the fall window            → peat & bagged fallback
 *   Nov 1  → Dec 31  spring bareroot PREORDER         (deposit now; ships spring)
 * (window endpoints stagger per zone — GOL-1172. Global preorder switches:
 *  fall Aug 15, spring Nov 1.)
 */

export type { ShippableMode };

/*
 * Ratified preorder deposit (GOL-1302, Josh 2026-08-12): a flat $10.00 per
 * preorder line, charged when the preorder window opens; the balance is charged
 * to the saved card when the tree ships in the shopper's zone window. This flat
 * amount supersedes the earlier 25% figure (GOL-1173 §3). The exact charge is
 * owned by the backend (`stripe_gateway.PREORDER_DEPOSIT = 10.00`) and surfaced
 * in the checkout order summary from the itemized `line_items` (`kind:
 * "deposit"`); the storefront copy below states the flat amount as a plain
 * string (matching `buy-state.ts` / `shipping-hints.ts`) and never computes it.
 */

export interface FulfillmentResolution {
  /** The single mode a bareroot-capable tree shows today. */
  mode: ShippableMode;
  /** True only for `bareroot-preorder` — a deposit is taken now (amount above). */
  depositNow: boolean;
  /** Which season a preorder ships in, else `null`. Drives the "ships this
   *  <season>" copy. */
  preorderSeason: "fall" | "spring" | null;
  /** Normal processing SLA (business days) for peat & bagged and the
   *  shipped-past-your-zone fallback, from `calendar.fulfillment_days`. */
  fulfillmentDays: [number, number];
}

/** Monotonic within-year key for a `[month, day]`: `0101`..`1231`. Day-level and
 *  leap-day-agnostic (the backend owns exact ship weeks); this ordering is all
 *  the mode boundaries need. */
function ord(md: MonthDay): number {
  return md[0] * 100 + md[1];
}

/** Extract a `[month, day]` from a Date in UTC, so a caller's timezone can never
 *  shift which mode a shopper sees near a midnight boundary. */
export function monthDayOf(date: Date): MonthDay {
  return [date.getUTCMonth() + 1, date.getUTCDate()];
}

/** Inclusive `[start, end]` membership within a single calendar year (no wrap —
 *  all four windows are within-year). */
function inWindow(d: number, window: [MonthDay, MonthDay]): boolean {
  return d >= ord(window[0]) && d <= ord(window[1]);
}

/** Reference default windows (doc §2), used only when the feed carries no zones
 *  at all — never hardcode a season in a component; read the zone's calendar. */
const DEFAULT_WINDOWS: ShippingCalendarZone = {
  fall: [
    [9, 15],
    [10, 30],
  ],
  spring: [
    [1, 1],
    [5, 5],
  ],
};

/** Widest span [earliest start, latest end] across a set of windows. */
function unionWindow(windows: [MonthDay, MonthDay][]): [MonthDay, MonthDay] {
  let start = windows[0][0];
  let end = windows[0][1];
  for (const [s, e] of windows) {
    if (ord(s) < ord(start)) start = s;
    if (ord(e) > ord(end)) end = e;
  }
  return [start, end];
}

/**
 * The fall/spring ship windows to resolve against.
 *
 * When the shopper's USDA hardiness zone is known, use that zone's exact windows
 * (fully correct). When it is unknown — the common storefront case, since the
 * product page collects a *distance* state for pricing, not a USDA zone — fall
 * back to the UNION of every zone's windows: the season's overall shippable span.
 * That is the honest storefront default ("bareroot ships this season"); checkout
 * re-resolves to the shopper's exact zone, which is the authoritative charge.
 */
function windowsFor(
  calendar: ShippingCalendar,
  usdaZone: number | null | undefined,
): ShippingCalendarZone {
  const exact =
    usdaZone != null ? calendar.zones?.[String(usdaZone)] : undefined;
  if (exact) return exact;

  const zones = Object.values(calendar.zones ?? {});
  if (zones.length === 0) return DEFAULT_WINDOWS;
  return {
    fall: unionWindow(zones.map((z) => z.fall)),
    spring: unionWindow(zones.map((z) => z.spring)),
  };
}

/**
 * Resolve the single shippable mode for `date` under a zone's `calendar`.
 *
 * Priority mirrors the doc timeline: an in-window ("ships now") state wins over a
 * preorder state, and anything not claimed by a bareroot cycle falls through to
 * peat & bagged. That fall-through is deliberate — it covers both the summer
 * leafed window (May 6 → Aug 14) AND the post-window gap (e.g. Oct 31, after the
 * fall window has shipped but before spring preorder opens), which is Josh's
 * "shipped-past-your-zone → normal 5–10 business-day fallback, never held as
 * preorder" rule (doc §2 edge case). So there are never dead months.
 */
export function resolveShippableMode(
  date: Date,
  calendar: ShippingCalendar,
  usdaZone?: number | null,
): FulfillmentResolution {
  const d = ord(monthDayOf(date));
  const { fall, spring } = windowsFor(calendar, usdaZone);
  const fulfillmentDays = calendar.fulfillment_days ?? [5, 10];

  // 1. In a bareroot ship window → ships now (wins over any preorder).
  if (inWindow(d, spring)) {
    return { mode: "bareroot-in-window", depositNow: false, preorderSeason: null, fulfillmentDays };
  }
  if (inWindow(d, fall)) {
    return { mode: "bareroot-in-window", depositNow: false, preorderSeason: null, fulfillmentDays };
  }

  // 2. Fall preorder: from the Aug 15 switch up to (not into) the fall window.
  if (d >= ord(calendar.preorder_open.fall) && d < ord(fall[0])) {
    return { mode: "bareroot-preorder", depositNow: true, preorderSeason: "fall", fulfillmentDays };
  }

  // 3. Spring preorder: from the Nov 1 switch through year-end, then into Jan up
  //    to (not into) the spring window. preorder_open.spring (Nov) > spring start
  //    (Jan), so this window wraps the year boundary.
  if (d >= ord(calendar.preorder_open.spring) || d < ord(spring[0])) {
    return { mode: "bareroot-preorder", depositNow: true, preorderSeason: "spring", fulfillmentDays };
  }

  // 4. Everything else (summer leafed window + post-fall-window gap) → peat &
  //    bagged, the no-dead-months fallback on the normal 5–10 business-day policy.
  return { mode: "peat-and-bagged", depositNow: false, preorderSeason: null, fulfillmentDays };
}

// ── Customer-facing copy (GOL-1173 ratified; no em dashes, brand rule) ────────

/** Short badge for a bareroot format, or `null` when it just ships in season
 *  (an in-window bareroot needs no badge — "Ships now" carries it). */
export function barerootBadge(res: FulfillmentResolution): string | null {
  switch (res.mode) {
    case "bareroot-preorder":
      return "Preorder";
    case "peat-and-bagged":
      return "Peat & bagged";
    default:
      return null;
  }
}

/** Compact timing line for the "Label · <timing>" card / estimator row. Always
 *  paired with the label in words, never colour alone (a11y / colour-blind safe). */
export function barerootTimingShort(res: FulfillmentResolution): string {
  switch (res.mode) {
    case "bareroot-preorder":
      return `$10 deposit · ships this ${res.preorderSeason}`;
    case "bareroot-in-window":
      return "Ships now";
    case "peat-and-bagged":
      return `Ships in ${res.fulfillmentDays[0]}–${res.fulfillmentDays[1]} business days`;
  }
}

/**
 * Full buy-box note for the selected bareroot format. The preorder wording is
 * the ratified GOL-1302 flat-$10 copy (Josh 2026-08-12); the in-window
 * and peat & bagged lines are plain factual descriptions of the fulfillment we
 * perform (no persuasive claims, no em dashes) and are safe to render without
 * further brand sign-off.
 */
export function barerootNote(res: FulfillmentResolution): string {
  switch (res.mode) {
    case "bareroot-preorder":
      return `Reserve now with a $10 deposit per tree. We charge the rest when your tree ships this ${res.preorderSeason}, timed to your area.`;
    case "bareroot-in-window":
      return "It is bareroot season. We dig your trees fresh and ship them dormant, timed to your area.";
    case "peat-and-bagged":
      return `Shipping now as peat and bagged: leafed-out trees wrapped in damp peat, up to four per box, on our normal ${res.fulfillmentDays[0]} to ${res.fulfillmentDays[1]} business day timeline.`;
  }
}
