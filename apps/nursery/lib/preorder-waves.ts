import type {
  MonthDay,
  PreorderWave,
  ShippingCalendar,
  ShippingCalendarZone,
  ShipWave,
} from "@grove/odoo-client";
import { formatMonthDay, monthDayOf } from "./fulfillment-mode";

/**
 * Fall / Spring bareroot pre-order waves (Josh 2026-10-07). Both waves open
 * Sep 1; each stays selectable through the zone's order-by (inclusive) and is
 * shown greyed after it. The feed's server-resolved
 * `calendar.resolved[zone].waves` (gom #326) is the authority; this module's
 * port of `grove_headless.shipping_calendar.preorder_waves` (B1) is the fallback
 * for a feed that predates it. Checkout re-validates the wave either way.
 */

/** Both pre-order waves open on this (UTC) month/day. */
export const PREORDER_WAVES_OPEN: MonthDay = [9, 1];

/** USDA zone of the farm (pickup ZIP 26651), used when the feed lacks one. */
export const FARM_ZONE = 6;

/** localStorage key for the shopper's USDA zone (same namespace as `grove:ship-state`). */
export const USDA_ZONE_KEY = "grove:usda-zone";

/**
 * Bundled copy of `WAVE_SCHEDULE` (grove_headless shipping_calendar.py) for a
 * feed without a calendar: per zone, the fall/spring ship windows and order-bys.
 */
const DEFAULT_ZONE_CALENDAR: Record<string, Required<ShippingCalendarZone>> = (() => {
  const row = (
    fall: [MonthDay, MonthDay, MonthDay],
    spring: [MonthDay, MonthDay, MonthDay],
  ): Required<ShippingCalendarZone> => ({
    fall: [fall[0], fall[1]],
    spring: [spring[0], spring[1]],
    fall_order_deadline: fall[2],
    spring_order_deadline: spring[2],
  });
  const north = row(
    [[11, 2], [11, 13], [11, 12]],
    [[4, 8], [4, 15], [4, 1]],
  );
  const mid = row(
    [[11, 2], [11, 19], [11, 16]],
    [[4, 8], [4, 15], [4, 1]],
  );
  const south = row(
    [[11, 9], [12, 12], [11, 21]],
    [[3, 1], [4, 15], [2, 22]],
  );
  return {
    "2": north,
    "3": north,
    "4": mid,
    "5": row([[11, 2], [11, 19], [11, 16]], [[4, 12], [4, 15], [4, 5]]),
    "6": row([[11, 9], [11, 26], [11, 21]], [[4, 5], [4, 15], [3, 29]]),
    "7": row([[11, 9], [11, 26], [11, 21]], [[3, 16], [4, 15], [3, 9]]),
    "8": south,
    "9": south,
    "10": south,
  };
})();

/** Zones the bundled schedule covers, ascending. */
export const DEFAULT_WAVE_ZONES: number[] = Object.keys(DEFAULT_ZONE_CALENDAR)
  .map(Number)
  .sort((a, b) => a - b);

const ord = (md: MonthDay) => md[0] * 100 + md[1];

/** Is `date` (UTC) on/after Sep 1, the day both pre-order waves open? */
export function isPreorderSeason(date: Date): boolean {
  return ord(monthDayOf(date)) >= ord(PREORDER_WAVES_OPEN);
}

/** TS port of B1 `preorder_waves` for one zone's calendar entry. */
function computeWaves(
  date: Date,
  z: ShippingCalendarZone,
  fallBy: MonthDay,
  springBy: MonthDay,
): PreorderWave[] {
  const t = ord(monthDayOf(date));
  const sepOn = t >= ord(PREORDER_WAVES_OPEN);

  const fallOpen = sepOn && t <= ord(fallBy);
  const fallReason = sepOn ? "deadline_passed" : "opens_sep_1";
  const springOpen = sepOn || t <= ord(springBy);
  // Closed spring: name the deadline that just passed through June, then point
  // at the Sep 1 reopening for the rest of the summer.
  const springReason = t <= ord([6, 30]) ? "deadline_passed" : "opens_sep_1";

  const entry = (
    wave: ShipWave,
    window: [MonthDay, MonthDay],
    orderBy: MonthDay,
    open: boolean,
    reason: "deadline_passed" | "opens_sep_1",
  ): PreorderWave => ({
    wave,
    ship_window: [[...window[0]] as MonthDay, [...window[1]] as MonthDay],
    order_by: [...orderBy] as MonthDay,
    open,
    reason: open ? null : reason,
  });
  return [
    entry("fall", z.fall, fallBy, fallOpen, fallReason),
    entry("spring", z.spring, springBy, springOpen, springReason),
  ];
}

/**
 * Fall then spring pre-order waves for `zone` on `date`. Feed-resolved waves
 * win; else the feed's zone calendar (order-bys filled from the bundled
 * schedule when a zone override omits them); else the bundled schedule.
 * An unknown zone returns [].
 */
export function preorderWaves(
  zone: number,
  date: Date,
  calendar?: ShippingCalendar | null,
): PreorderWave[] {
  const key = String(zone);
  const resolved = calendar?.resolved?.[key]?.waves;
  if (resolved && resolved.length > 0) return resolved;
  const fallback = DEFAULT_ZONE_CALENDAR[key];
  const fromFeed = calendar?.zones?.[key];
  const z = fromFeed?.fall && fromFeed.spring ? fromFeed : fallback;
  const fallBy = z?.fall_order_deadline ?? fallback?.fall_order_deadline;
  const springBy = z?.spring_order_deadline ?? fallback?.spring_order_deadline;
  if (!z || !fallBy || !springBy) return [];
  return computeWaves(date, z, fallBy, springBy);
}

/** The first open wave (fall before spring), or null when none is open. */
export function firstOpenWave(waves: readonly PreorderWave[]): ShipWave | null {
  return waves.find((w) => w.open)?.wave ?? null;
}

/** USDA zones to offer in the zone select: the feed's, else the bundled ones. */
export function waveZones(calendar?: ShippingCalendar | null): number[] {
  const keys = calendar?.zones ? Object.keys(calendar.zones) : [];
  const zones = keys.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return zones.length > 0 ? zones.sort((a, b) => a - b) : DEFAULT_WAVE_ZONES;
}

/** Farm pickup zone from the feed when it carries one, else {@link FARM_ZONE}. */
export function farmZoneOf(feed: unknown): number {
  const z = (feed as { farm_zone?: unknown } | null | undefined)?.farm_zone;
  return typeof z === "number" && Number.isInteger(z) ? z : FARM_ZONE;
}

/** "Approx Nov 9 to Dec 12". */
export function waveWindowLabel(w: PreorderWave): string {
  return `Approx ${formatMonthDay(w.ship_window[0])} to ${formatMonthDay(w.ship_window[1])}`;
}

/** "Order by Nov 21". */
export function waveOrderByLabel(w: PreorderWave): string {
  return `Order by ${formatMonthDay(w.order_by)}`;
}

/** Why a closed wave is greyed: "Order-by passed" or "Opens Sep 1". */
export function waveClosedLabel(w: PreorderWave): string {
  return w.reason === "opens_sep_1" ? "Opens Sep 1" : "Order-by passed";
}

/** The shopper's remembered USDA zone, or null. Never throws. */
export function readUsdaZone(): number | null {
  try {
    const v = localStorage.getItem(USDA_ZONE_KEY);
    if (v == null || !/^\d{1,2}$/.test(v)) return null;
    return Number(v);
  } catch {
    return null;
  }
}

/** Remember the shopper's USDA zone. No-op when localStorage is unavailable. */
export function writeUsdaZone(zone: number): void {
  try {
    localStorage.setItem(USDA_ZONE_KEY, String(zone));
  } catch {
    /* localStorage unavailable (private mode): no-op */
  }
}
