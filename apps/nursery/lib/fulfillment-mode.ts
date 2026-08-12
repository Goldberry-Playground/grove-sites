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
 * The customer-facing wording (deposit %, preorder sublines) is the ratified
 * GOL-1173 copy (doc `preorder-deposit-copy`, Josh/Abigail sign-off 2026-08-06).
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

/** Ratified preorder deposit (GOL-1173, Josh 2026-08-06): 25% charged when the
 *  preorder window opens; the 75% balance is charged to the saved card when the
 *  tree ships in the shopper's zone window. Single source of the storefront %. */
export const PREORDER_DEPOSIT_PCT = 25;

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
  /** Last day to reserve for the resolved wave, as `[month, day]` — only set for
   *  a KNOWN zone in a `bareroot-preorder` / `bareroot-in-window` state (the
   *  deadline is per-zone; `null` for peat & bagged or the zone-agnostic
   *  storefront default). Drives the "order by <date>" line. */
  orderDeadline: MonthDay | null;
  /** Windows are estimates, "weather permitting" (GOL-1177). `true` (default)
   *  means the copy should carry a weather-permitting qualifier. */
  approximate: boolean;
  /** Admin-set frost-delay advisory to render as a banner, or `null` when no
   *  hold is active (GOL-1177). */
  weatherHoldNote: string | null;
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

/** Reference default windows, used only when the feed carries no zones at all
 *  (a degraded feed — the backend always serializes every zone). These MIRROR
 *  the backend's `WAVE_SCHEDULE` union (grove_headless shipping_calendar.py):
 *  fall Nov 2 → Dec 12, spring Mar 1 → Jun 6. They must not drift below the
 *  backend's earliest ship date, or the fallback would promise "ships now" weeks
 *  before the backend would actually ship (GOL-1313 finding 2 — the old Sep 15 /
 *  Jan 1 defaults claimed shipping through hard-freeze January). Never hardcode a
 *  season in a component; read the zone's calendar. */
const DEFAULT_WINDOWS: ShippingCalendarZone = {
  fall: [
    [11, 2],
    [12, 12],
  ],
  spring: [
    [3, 1],
    [6, 6],
  ],
};

/** The season a resolution pertains to, used to pick the per-zone order deadline
 *  (peat & bagged has none). */
type ResolvedSeason = "fall" | "spring" | null;

interface ZoneResolution {
  mode: ShippableMode;
  depositNow: boolean;
  preorderSeason: "fall" | "spring" | null;
  /** The window this resolution matched (for deadline lookup); `null` for peat. */
  season: ResolvedSeason;
}

/**
 * Resolve the mode for `date` against ONE zone's windows.
 *
 * Priority mirrors the backend `resolve_fulfillment` timeline: an in-window
 * ("ships now") state wins over a preorder state, and anything not claimed by a
 * bareroot cycle falls through to peat & bagged. That fall-through is deliberate
 * — it covers both the summer leafed window (May 6 → Aug 14) AND the post-window
 * gap (e.g. after the fall window has shipped but before spring preorder opens),
 * which is Josh's "shipped-past-your-zone → normal business-day fallback, never
 * held as preorder" rule. So there are never dead months.
 *
 * `preorder_open` is read defensively (GOL-1313 finding 1): a partial calendar
 * that omits it never throws here — the preorder branches are simply skipped and
 * the date falls through to peat & bagged. (The feed loader also rejects such a
 * calendar up front, so this is belt-and-suspenders.)
 */
function resolveZone(
  d: number,
  zone: ShippingCalendarZone,
  preorderOpen: ShippingCalendar["preorder_open"] | undefined,
): ZoneResolution {
  const { fall, spring } = zone;

  // 1. In a bareroot ship window → ships now (wins over any preorder).
  if (inWindow(d, spring)) {
    return { mode: "bareroot-in-window", depositNow: false, preorderSeason: null, season: "spring" };
  }
  if (inWindow(d, fall)) {
    return { mode: "bareroot-in-window", depositNow: false, preorderSeason: null, season: "fall" };
  }

  // 2. Fall preorder: from the fall switch up to (not into) the fall window.
  if (preorderOpen?.fall && d >= ord(preorderOpen.fall) && d < ord(fall[0])) {
    return { mode: "bareroot-preorder", depositNow: true, preorderSeason: "fall", season: "fall" };
  }

  // 3. Spring preorder: from the spring switch through year-end, then into Jan up
  //    to (not into) the spring window (wraps the year boundary).
  if (preorderOpen?.spring && (d >= ord(preorderOpen.spring) || d < ord(spring[0]))) {
    return { mode: "bareroot-preorder", depositNow: true, preorderSeason: "spring", season: "spring" };
  }

  // 4. Everything else (leafed window + post-window gap) → peat & bagged.
  return { mode: "peat-and-bagged", depositNow: false, preorderSeason: null, season: null };
}

/**
 * Collapse per-zone resolutions into ONE honest storefront resolution for an
 * unknown USDA zone (GOL-1313 finding 3).
 *
 * The old code unioned every zone's windows and asserted "Ships now" (no deposit)
 * whenever ANY zone was in-window — so a shopper whose real (later) zone was still
 * on preorder met a deposit-shape surprise at checkout. This is the conservative
 * inverse: only promise the payment shape that can't surprise.
 *   - ANY zone still on preorder → show `bareroot-preorder` (deposit). A shopper
 *     whose zone actually ships now is only ever charged sooner, never later — the
 *     harmful direction (promised ships-now, hit with a deposit) is eliminated.
 *   - else if any zone is in its window → `bareroot-in-window` ("Ships now"); no
 *     deposit is taken for any remaining zone, so the promise is honest.
 *   - else every zone ships now on the normal policy → peat & bagged.
 * Checkout re-resolves to the shopper's exact zone, which is the authoritative
 * charge. (The real fix is the backend serving mode-per-zone — GOL-1313 altitude.)
 */
function aggregateZones(list: ZoneResolution[]): ZoneResolution {
  const preorder = list.find((r) => r.mode === "bareroot-preorder");
  if (preorder) return preorder;
  const inWin = list.find((r) => r.mode === "bareroot-in-window");
  if (inWin) return { ...inWin, season: null }; // deadline is per-zone; unknown here
  return { mode: "peat-and-bagged", depositNow: false, preorderSeason: null, season: null };
}

/**
 * Resolve the single shippable mode for `date` under the feed's `calendar`.
 *
 * Known USDA zone → that zone's exact windows (fully correct, with its order
 * deadline). Unknown zone (the common storefront case — the product page collects
 * a distance state, not a USDA zone) → the conservative aggregate above; no zone
 * order deadline is asserted. No zones at all (degraded feed) → the backend-mirror
 * {@link DEFAULT_WINDOWS}.
 */
export function resolveShippableMode(
  date: Date,
  calendar: ShippingCalendar,
  usdaZone?: number | null,
): FulfillmentResolution {
  const d = ord(monthDayOf(date));
  const fulfillmentDays = calendar.fulfillment_days ?? [5, 10];
  const approximate = calendar.approximate ?? true;
  const weatherHoldNote = calendar.weather_hold_note ?? null;
  const preorderOpen = calendar.preorder_open;

  const exact =
    usdaZone != null ? calendar.zones?.[String(usdaZone)] : undefined;

  let resolved: ZoneResolution;
  let orderDeadline: MonthDay | null = null;

  if (exact) {
    resolved = resolveZone(d, exact, preorderOpen);
    orderDeadline = deadlineFor(exact, resolved.season);
  } else {
    const zones = Object.values(calendar.zones ?? {});
    resolved =
      zones.length === 0
        ? resolveZone(d, DEFAULT_WINDOWS, preorderOpen)
        : aggregateZones(zones.map((z) => resolveZone(d, z, preorderOpen)));
  }

  return {
    mode: resolved.mode,
    depositNow: resolved.depositNow,
    preorderSeason: resolved.preorderSeason,
    fulfillmentDays,
    orderDeadline,
    approximate,
    weatherHoldNote,
  };
}

/** The order-by deadline for the matched season, or `null` (peat & bagged, or a
 *  zone override that omits the deadline). */
function deadlineFor(zone: ShippingCalendarZone, season: ResolvedSeason): MonthDay | null {
  if (season === "fall") return zone.fall_order_deadline ?? null;
  if (season === "spring") return zone.spring_order_deadline ?? null;
  return null;
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
      return `${PREORDER_DEPOSIT_PCT}% deposit · ships this ${res.preorderSeason}`;
    case "bareroot-in-window":
      return "Ships now";
    case "peat-and-bagged":
      return `Ships in ${res.fulfillmentDays[0]}–${res.fulfillmentDays[1]} business days`;
  }
}

/**
 * Full buy-box note for the selected bareroot format. The preorder wording is
 * verbatim ratified GOL-1173 copy (doc `preorder-deposit-copy` §2); the in-window
 * and peat & bagged lines are plain factual descriptions of the fulfillment we
 * perform (no persuasive claims, no em dashes) and are safe to render without
 * further brand sign-off.
 */
export function barerootNote(res: FulfillmentResolution): string {
  switch (res.mode) {
    case "bareroot-preorder":
      return `Reserve now with a ${PREORDER_DEPOSIT_PCT}% deposit. We charge the rest when your tree ships this ${res.preorderSeason}, timed to your area.`;
    case "bareroot-in-window":
      return "It is bareroot season. We dig your trees fresh and ship them dormant, timed to your area.";
    case "peat-and-bagged":
      return `Shipping now as peat and bagged: leafed-out trees wrapped in damp peat, up to four per box, on our normal ${res.fulfillmentDays[0]} to ${res.fulfillmentDays[1]} business day timeline.`;
  }
}

// ── Advisory copy (GOL-1177 contract fields, surfaced GOL-1313 finding 5) ─────

const MONTH_ABBR = [
  "",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** "Nov 21" — locale-free, matches the backend `_fmt` so the two never disagree. */
export function formatMonthDay(md: MonthDay): string {
  return `${MONTH_ABBR[md[0]]} ${md[1]}`;
}

/** "Order by Nov 21" for a known-zone bareroot wave, or `null` when there is no
 *  deadline to show (peat & bagged, or an unknown zone). Lets a shopper see the
 *  last reserve date for their zone (GOL-1177 `order_deadline`). */
export function orderDeadlineLine(res: FulfillmentResolution): string | null {
  if (!res.orderDeadline) return null;
  if (res.mode === "peat-and-bagged") return null;
  return `Order by ${formatMonthDay(res.orderDeadline)}`;
}
