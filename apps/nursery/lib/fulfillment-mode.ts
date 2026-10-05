import type {
  ShippableMode,
  ShippingCalendar,
  ShippingCalendarZone,
  MonthDay,
  ShippingTier,
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
 * Potted is out of scope, but NOT because it cannot ship: GOL-2199 (2026-09-08)
 * put potted back on its own shipping engine, and the storefront caught up in
 * GOL-2757 / grove-sites#813 — see `isPickupOnly` in `shipping-estimate.ts`,
 * which now gates on whether the feed actually prices a potted box rather than
 * asserting potted is pickup-only. It is out of scope here because potted packs
 * and ships by UNIT COUNT on the normal fulfilment SLA and never enters the
 * dormant-window / deposit state machine this resolver models. Only ask this
 * resolver about a bareroot-capable product.
 *
 * The calendar drives ship-window TIMING (which season a tree ships in, and the
 * peat & bagged leafed fallback). The CHARGE shape (deposit vs charged-in-full)
 * is a SEPARATE axis, decided by the GOL-2233 `_order_takes_deposit` rule below,
 * not by these windows.
 *
 * Because the two axes are independent, "charged in full" does NOT imply "ships
 * today": an in-stock, pre-cutover bareroot placed in the gap between the
 * preorder switch and the zone's ship window is charged in full NOW and ships in
 * that window (grove-sites#814 / GOL-2757 — the copy used to fuse the two and
 * claim "Ships now" on a September date while the same feed said zone 5 ships
 * Nov 2 - Nov 19). {@link FulfillmentResolution.shipSeason} carries the timing
 * half: non-null means "ships in that upcoming dormant wave", whatever the
 * charge. Ship-window timeline (doc §2):
 *   Jan 1  → May 5   spring bareroot ships in the zone's spring window
 *   May 6  → Aug 14  peat & bagged (leafed)         (5–10 business days)
 *   Sep 15 → Oct 30  fall bareroot ships in the zone's fall window
 *   Oct 31           past the fall window            → peat & bagged fallback
 * (window endpoints stagger per zone — GOL-1172. The old "PREORDER — deposit now"
 * mapping for Aug 15–Sep 14 / Nov 1–Dec 31 is RETIRED: an in-stock bareroot on or
 * before the Oct 15 cutover now ships and is charged in full regardless of the
 * calendar window; see the deposit-rule note on {@link DEPOSIT_CUTOVER}.)
 */

export type { ShippableMode };

/*
 * Deposit rule (GOL-2233, CEO ruling 2026-09-09): a flat $10.00 deposit for the
 * WHOLE order (not per line, not per unit — 100 trees is still one $10 deposit),
 * charged only when the order "takes a deposit"; the balance is charged to the
 * saved card when the trees ship, timed to the shopper's zone window.
 *
 * The charge SHAPE is decided by the backend `_order_takes_deposit` predicate
 * (grove-odoo-modules#218 + #219), NOT by the ship-window calendar:
 *   • the variant is SOLD OUT of free stock (a sold-out bareroot line), OR
 *   • the order is placed AFTER the season cutover (default Oct 15).
 * Either trigger routes the whole order to the flat deposit. An IN-STOCK bareroot
 * on or before the cutover ships now and is charged in FULL today. This supersedes
 * the earlier calendar-window "PREORDER — deposit now" model (GOL-1114/1302): the
 * ship-window calendar still names WHEN a tree ships and the peat & bagged
 * (leafed) fallback, but no longer forces the deposit path.
 *
 * The exact amount is owned by the backend (`stripe_gateway.PREORDER_DEPOSIT =
 * 10.00`, flat per order) and surfaced in the checkout order summary from the
 * itemized `line_items` (`kind: "deposit"`); the storefront copy below states the
 * flat amount as a plain string and never computes it.
 */

/** The season cutover after which every bareroot order takes the flat deposit
 *  (GOL-2233). Mirrors the backend `grove_headless.deposit_cutover_md`
 *  (`DEFAULT_DEPOSIT_CUTOVER_MD = (10, 15)` — Oct 15). Kept in sync by fixture,
 *  not by import, since this is the storefront copy layer. */
export const DEPOSIT_CUTOVER: MonthDay = [10, 15];

/** Why an order takes the flat $10 deposit, or `null` when it ships now and is
 *  charged in full. Drives which reserve lead sentence the buy-box shows. */
export type DepositReason = "sold-out" | "off-season" | null;

export interface FulfillmentResolution {
  /** The single mode a bareroot-capable tree shows today. */
  mode: ShippableMode;
  /** True when the order takes the flat $10 deposit (`bareroot-preorder`), per
   *  the GOL-2233 `_order_takes_deposit` rule (sold-out OR after Oct 15). */
  depositNow: boolean;
  /** Why the deposit is taken (`"sold-out"` / `"off-season"`), or `null` when the
   *  order ships now and is charged in full. */
  depositReason: DepositReason;
  /** The upcoming dormant wave this order actually SHIPS in, or `null` when it
   *  ships today on the normal SLA (an open bareroot window, or peat & bagged).
   *  Purely the TIMING axis: it is set both for a deposit/reserve order AND for
   *  an order charged in full today that still waits for its zone's window
   *  (grove-sites#814). Drives every "ships this <season>" phrase. */
  shipSeason: "fall" | "spring" | null;
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

/**
 * Does an order placed on `date` take the flat $10 deposit on the SEASON CUTOVER
 * alone, with variant stock unknown? (grove-sites#815 / GOL-2757.)
 *
 * The GOL-2233 deposit rule is `soldOut || afterCutover`, and {@link
 * DEPOSIT_CUTOVER} is a local constant — so the cutover half needs NO rate feed.
 * Only the per-zone ship WINDOWS do. A surface that states the deposit rule must
 * therefore keep stating it when the feed is unreachable: the homepage Field
 * Notes card used to fall back to `heroResolution?.depositNow` (falsy on a
 * degraded feed) and so promised "charged in full ... after Oct 15" in November,
 * while checkout would in fact take a deposit. That is GOL-1313 finding 3's
 * harmful surprise direction (promised charged-in-full, met with a deposit), so
 * the date-only answer is the honest fallback, never "no deposit".
 *
 * Conservative by construction: with stock unknown this can only UNDER-claim a
 * deposit (a sold-out variant before the cutover still reads charged-in-full on
 * a feedless surface), and the PDP — which does know the variant's stock — is the
 * surface that resolves that half.
 */
export function depositByDate(date: Date, cutover: MonthDay = DEPOSIT_CUTOVER): boolean {
  return ord(monthDayOf(date)) > ord(cutover);
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
export const DEFAULT_WINDOWS: ShippingCalendarZone = {
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
  shipSeason: "fall" | "spring" | null;
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
    return { mode: "bareroot-in-window", depositNow: false, shipSeason: null, season: "spring" };
  }
  if (inWindow(d, fall)) {
    return { mode: "bareroot-in-window", depositNow: false, shipSeason: null, season: "fall" };
  }

  // 2. Fall preorder: from the fall switch up to (not into) the fall window.
  if (preorderOpen?.fall && d >= ord(preorderOpen.fall) && d < ord(fall[0])) {
    return { mode: "bareroot-preorder", depositNow: true, shipSeason: "fall", season: "fall" };
  }

  // 3. Spring preorder: from the spring switch through year-end, then into Jan up
  //    to (not into) the spring window (wraps the year boundary).
  if (preorderOpen?.spring && (d >= ord(preorderOpen.spring) || d < ord(spring[0]))) {
    return { mode: "bareroot-preorder", depositNow: true, shipSeason: "spring", season: "spring" };
  }

  // 4. Everything else (leafed window + post-window gap) → peat & bagged.
  return { mode: "peat-and-bagged", depositNow: false, shipSeason: null, season: null };
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
  return { mode: "peat-and-bagged", depositNow: false, shipSeason: null, season: null };
}

/** Deposit-decision inputs (GOL-2233). Optional so the existing zone-only call
 *  sites keep working; both fields default to the "ships now, charged in full"
 *  side of the rule (in-stock, before the cutover). */
export interface ResolveDepositOpts {
  /** Selected variant is out of free (shared-pool) stock — the sold-out deposit
   *  trigger (GOL-2233). Defaults false. */
  soldOut?: boolean;
  /** Season cutover after which every bareroot order takes the flat deposit;
   *  defaults to {@link DEPOSIT_CUTOVER} (Oct 15). Injectable for tests. */
  depositCutover?: MonthDay;
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
  opts?: ResolveDepositOpts,
): FulfillmentResolution {
  const d = ord(monthDayOf(date));
  const fulfillmentDays = calendar.fulfillment_days ?? [5, 10];
  const approximate = calendar.approximate ?? true;
  const weatherHoldNote = calendar.weather_hold_note ?? null;
  const preorderOpen = calendar.preorder_open;

  const exact =
    usdaZone != null ? calendar.zones?.[String(usdaZone)] : undefined;

  // Ship-window TIMING (which season / peat & bagged fallback applies today).
  // This still comes from the per-zone calendar; it names WHEN a tree ships, and
  // the season word the reserve copy uses, but no longer decides the CHARGE.
  let timing: ZoneResolution;
  let orderDeadline: MonthDay | null = null;

  if (exact) {
    timing = resolveZone(d, exact, preorderOpen);
    orderDeadline = deadlineFor(exact, timing.season);
  } else {
    const zones = Object.values(calendar.zones ?? {});
    timing =
      zones.length === 0
        ? resolveZone(d, DEFAULT_WINDOWS, preorderOpen)
        : aggregateZones(zones.map((z) => resolveZone(d, z, preorderOpen)));
  }

  // CHARGE shape (GOL-2233): mirror the backend `_order_takes_deposit` — the
  // order takes the flat $10 deposit when it is sold-out bareroot OR placed after
  // the season cutover (Oct 15). `soldOut` defaults false, which reduces the
  // decision to the cutover alone — the honest tier-level default before a
  // specific variant's stock is known.
  const soldOut = opts?.soldOut ?? false;
  const afterCutover = d > ord(opts?.depositCutover ?? DEPOSIT_CUTOVER);
  const depositReason: DepositReason = afterCutover
    ? "off-season"
    : soldOut
      ? "sold-out"
      : null;
  const depositNow = depositReason !== null;

  let mode: ShippableMode;
  let shipSeason: "fall" | "spring" | null;
  if (depositNow) {
    mode = "bareroot-preorder";
    // Ship the reserved order in the next dormant wave: the calendar's current
    // season when known, else the next wave (spring once the fall window has
    // closed at the cutover, otherwise the coming fall).
    shipSeason = timing.shipSeason ?? timing.season ?? (afterCutover ? "spring" : "fall");
  } else if (timing.mode === "peat-and-bagged") {
    // In-stock, on/before the cutover, but in the leafed window → peat & bagged,
    // charged in full on the normal SLA (never a deposit).
    mode = "peat-and-bagged";
    shipSeason = null;
  } else {
    // In-stock bareroot, on or before the cutover → charged in FULL today. The
    // TIMING is still the calendar's: only an OPEN ship window ships today; in
    // the preorder gap (past the season's switch, before the zone's window) the
    // order is charged now and ships in that wave. Carrying the wave here is the
    // grove-sites#814 fix — collapsing it to `null` made the copy claim "Ships
    // now" on a date no zone ships on.
    mode = "bareroot-in-window";
    shipSeason = timing.mode === "bareroot-in-window" ? null : timing.shipSeason ?? timing.season;
  }

  return {
    mode,
    depositNow,
    depositReason,
    shipSeason,
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

/** Short badge for a bareroot format, or `null` when the timing line already
 *  carries the state. An in-window bareroot needs no badge ("Ships now" carries
 *  it), and neither does a charged-in-full order waiting on its zone window —
 *  its timing line names the wave, and a second badge there would either repeat
 *  it or (worse, if it read "Reserve") imply a deposit that is not taken. */
export function barerootBadge(res: FulfillmentResolution): string | null {
  switch (res.mode) {
    case "bareroot-preorder":
      return "Reserve";
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
      return `$10 to reserve · ships this ${res.shipSeason}`;
    case "bareroot-in-window":
      // Charge and timing are separate clauses, never fused (grove-sites#814):
      // only an OPEN ship window may say "Ships now".
      return res.shipSeason
        ? `Charged in full today · ships this ${res.shipSeason}`
        : "Ships now · charged in full";
    case "peat-and-bagged":
      return `Ships in ${res.fulfillmentDays[0]}–${res.fulfillmentDays[1]} business days`;
  }
}

/**
 * Full buy-box note for the selected bareroot format (GOL-2233 ruling). The
 * charge shape is keyed to the backend `_order_takes_deposit` rule: an in-stock
 * bareroot on or before the Oct 15 cutover ships now and is charged in full; a
 * sold-out variant or any order after the cutover takes ONE flat $10 deposit for
 * the whole order, with the balance charged at ship time. The two lead sentences
 * split on {@link FulfillmentResolution.depositReason} so the shopper knows WHY
 * a deposit applies. The in-window branch splits again on
 * {@link FulfillmentResolution.shipSeason}: charged in full AND shipping today
 * (window open) vs charged in full today but shipping in the zone's upcoming
 * wave (grove-sites#814). Plain factual copy, no persuasive claims, no em dashes.
 */
export function barerootNote(res: FulfillmentResolution): string {
  switch (res.mode) {
    case "bareroot-preorder": {
      const lead =
        res.depositReason === "sold-out"
          ? "This size is sold out for now."
          : "Bareroot planting season is closed for now.";
      return `${lead} Reserve your whole order with a flat $10 deposit and we charge the balance when your trees ship this ${res.shipSeason}, timed to your area.`;
    }
    case "bareroot-in-window":
      return res.shipSeason
        ? `Charged in full today, nothing else to pay. We dig your trees fresh and ship them dormant this ${res.shipSeason}, timed to your area.`
        : "Ships now and charged in full today. We dig your trees fresh and ship them dormant, timed to your area.";
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

/**
 * The single place that decides a shipping tier's display label + fulfillment
 * line + badge, shared by the estimator rows and the Format cards so the
 * presentations can never drift (GOL-1313 — the chain was duplicated). Bareroot
 * follows today's resolved mode when the calendar feed is live; a pickup-only
 * tier shows the pickup line; every other tier keeps its static hint.
 *
 * Label rule (Josh 2026-09-06): while the resolved mode is peat & bagged, the
 * shippable option IS peat & bagged — what ships is the potted stock, de-potted
 * and bagged at packing — so the option is NAMED "Peat & bagged" (no badge;
 * a badge would repeat the name). Once the calendar flips to the fall preorder
 * (Oct 16 under the current sysparam) it reads "Bareroot" again with the
 * preorder treatment.
 */
export function tierFulfillment(input: {
  tier: ShippingTier;
  /** Natural label for the option ("Bareroot" / the Format axis value). */
  label: string;
  pickupOnly: boolean;
  pickupFulfillment: string;
  hintFulfillment: string;
  shipMode: FulfillmentResolution | null;
}): { label: string; fulfillment: string; badge: string | null } {
  const { tier, label, pickupOnly, pickupFulfillment, hintFulfillment, shipMode } = input;
  if (pickupOnly) return { label, fulfillment: pickupFulfillment, badge: null };
  if (tier === "bareroot" && shipMode) {
    if (shipMode.mode === "peat-and-bagged") {
      return { label: "Peat & bagged", fulfillment: barerootTimingShort(shipMode), badge: null };
    }
    return { label, fulfillment: barerootTimingShort(shipMode), badge: barerootBadge(shipMode) };
  }
  return { label, fulfillment: hintFulfillment, badge: null };
}

/** "Order by Nov 21" for a known-zone bareroot wave, or `null` when there is no
 *  deadline to show (peat & bagged, or an unknown zone). Lets a shopper see the
 *  last reserve date for their zone (GOL-1177 `order_deadline`). */
export function orderDeadlineLine(res: FulfillmentResolution): string | null {
  if (!res.orderDeadline) return null;
  if (res.mode === "peat-and-bagged") return null;
  return `Order by ${formatMonthDay(res.orderDeadline)}`;
}

/**
 * One row of the homepage "Field Notes" per-zone list: the zone's NEXT bareroot
 * ship window (`Ships Nov 2 – Nov 13`) and its order-by note. Reads the per-zone
 * calendar directly — the window names WHEN a deposit/reserved order ships; it
 * does not decide the charge shape (that is the GOL-2233 deposit rule, see
 * {@link DEPOSIT_CUTOVER}). Spring windows end earliest in the year, then fall,
 * then (past the fall window) next spring. Unknown zone → no invented dates.
 */
export function zoneShipNote(
  date: Date,
  calendar: ShippingCalendar,
  zone: number,
): { label: string; note: string | null } {
  const z = calendar.zones?.[String(zone)];
  if (!z) return { label: "Confirmed at checkout", note: null };
  const d = ord(monthDayOf(date));
  const season = d <= ord(z.spring[1]) ? "spring" : d <= ord(z.fall[1]) ? "fall" : "spring";
  const win = z[season];
  const deadline = season === "fall" ? z.fall_order_deadline : z.spring_order_deadline;
  return {
    label: `Ships ${formatMonthDay(win[0])} – ${formatMonthDay(win[1])}`,
    note: deadline ? `Order by ${formatMonthDay(deadline)}` : null,
  };
}

// ── Ship-window envelope for zone-agnostic copy (GOL-2948) ───────────────────

/** The two dormant ship waves, collapsed across every zone the engine serves,
 *  plus which data the figure came from. `source: "snapshot"` means the live
 *  feed did not reach the surface and the baked {@link DEFAULT_WINDOWS} mirror
 *  was used — still a real window, never a literal typed into copy. */
export interface ShipWindowEnvelope {
  fall: [MonthDay, MonthDay];
  spring: [MonthDay, MonthDay];
  source: "feed" | "snapshot";
}

/** Widest `[start, end]` across a list of per-zone windows: earliest start,
 *  latest end. All four windows are within-year, so `ord` ordering is enough. */
function widest(windows: [MonthDay, MonthDay][]): [MonthDay, MonthDay] {
  return windows.reduce((acc, w) => [
    ord(w[0]) < ord(acc[0]) ? w[0] : acc[0],
    ord(w[1]) > ord(acc[1]) ? w[1] : acc[1],
  ]);
}

/**
 * Collapse the per-USDA-zone calendar into ONE fall window and ONE spring
 * window for a surface that cannot know the shopper's zone — the policy page's
 * at-a-glance box and its shipping-season prose (GOL-2948).
 *
 * This is a UNION, not the conservative aggregate {@link resolveShippableMode}
 * uses, and the difference is deliberate: that function answers "what will MY
 * order do", where over-promising is a broken promise, so it takes the
 * narrowest honest answer. This one answers "when does the nursery ship", a
 * question about the whole calendar, where narrowing would hide real ship dates
 * from the shoppers in the zones at either end (zone 7 opens spring six weeks
 * before zone 2; zones 8-10 ship into December and from March 1). Copy built on
 * this must therefore say the windows stagger by zone — the per-zone answer is
 * `zoneShipNote` / checkout.
 *
 * Why derived at all: the box used to hardcode "Feb - May", which matched no
 * zone in the feed. February ships nothing anywhere; June 1-6 ships to zones
 * 2-6; November and early December are the entire fall wave the storefront was
 * actively promoting while this box denied it. A calendar edit is a data change
 * (see the ownership note at the top of this module), so the only safe figure
 * is one read out of the calendar.
 *
 * Degrades to the backend-mirror {@link DEFAULT_WINDOWS} when no calendar
 * reaches the page, or when one arrives with no zones — the same fallback the
 * resolver uses, so a feedless policy page and a feedless buy box agree.
 */
export function shipWindowEnvelope(
  calendar?: ShippingCalendar | null,
): ShipWindowEnvelope {
  const zones = Object.values(calendar?.zones ?? {}).filter(
    (z): z is ShippingCalendarZone => Boolean(z?.fall && z?.spring),
  );
  if (zones.length === 0) {
    return {
      fall: DEFAULT_WINDOWS.fall,
      spring: DEFAULT_WINDOWS.spring,
      source: "snapshot",
    };
  }
  return {
    fall: widest(zones.map((z) => z.fall)),
    spring: widest(zones.map((z) => z.spring)),
    source: "feed",
  };
}

/** "Nov 2 - Nov 13" for a window, matching {@link zoneShipNote}'s separator so
 *  the policy page and the homepage zone rows read as one system. */
export function formatWindow(window: [MonthDay, MonthDay]): string {
  return `${formatMonthDay(window[0])} – ${formatMonthDay(window[1])}`;
}

/** Every month number a window touches, inclusive. Lets a test assert that no
 *  month appears in customer copy that the engine ships nothing in (GOL-2948) —
 *  the invariant the hardcoded "Feb - May" broke. */
export function monthsCovered(window: [MonthDay, MonthDay]): number[] {
  const months: number[] = [];
  for (let m = window[0][0]; m <= window[1][0]; m += 1) months.push(m);
  return months;
}
