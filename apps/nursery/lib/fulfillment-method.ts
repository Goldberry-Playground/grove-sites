import type {
  MonthDay,
  ShippingCalendar,
  ShippingTier,
} from "@grove/odoo-client";
import { monthDayOf } from "./fulfillment-mode";
import type { FulfillmentPref } from "./fulfillment-pref";

/**
 * Farm pickup vs Shipped, chosen BEFORE Format on the PDP (Josh 2026-10-07).
 *
 * Every plant listing is a Bareroot + Potted pair over one stock pool. The
 * potted variant is the IMMEDIATE purchase, sold only in the potted season
 * (feed `leafed_window`, prod May 1 to Oct 15) and charged in full: picked up it
 * goes home in the pot ("Potted"), shipped it leaves the pot at packing and
 * travels "Peat & bagged". The bareroot variant is always a pre-order for one
 * Fall/Spring wave ($10 deposit), offered from Sep 1 (when both waves open) and
 * for every date outside the potted season. See `preorder-waves.ts`.
 */
export type FulfillmentMethod = FulfillmentPref;

/** Prod `leafed_window`, used only when the feed carries no calendar. */
export const POTTED_SEASON_FALLBACK: [MonthDay, MonthDay] = [
  [5, 1],
  [10, 15],
];

const ord = (md: MonthDay) => md[0] * 100 + md[1];

/** Is `date` (UTC month/day) inside the potted season, endpoints inclusive? */
export function isPottedSeason(
  date: Date,
  calendar?: ShippingCalendar | null,
): boolean {
  const [start, end] = calendar?.leafed_window ?? POTTED_SEASON_FALLBACK;
  const d = ord(monthDayOf(date));
  return d >= ord(start) && d <= ord(end);
}

/**
 * The Format values to render for `method`, potted (immediate) first, then
 * bareroot (the pre-order card):
 *  - in the potted season: potted formats (shipped only when `pottedShips`),
 *    then bareroot formats once pre-orders are open (on/after Sep 1);
 *  - outside it: bareroot formats only, for both methods.
 * A sold-out potted format stays (its card says sold out); before Sep 1 that
 * means nothing bareroot is offered either, by design.
 */
export function formatsForMethod(
  formats: string[],
  method: FulfillmentMethod,
  tierOf: (format: string) => ShippingTier,
  opts: { pottedSeason: boolean; preorderSeason: boolean; pottedShips?: boolean },
): string[] {
  const potted = formats.filter((f) => tierOf(f) === "potted");
  const bareroot = formats.filter((f) => tierOf(f) !== "potted");
  if (!opts.pottedSeason) return bareroot;
  const immediate = method === "ship" && opts.pottedShips === false ? [] : potted;
  return opts.preorderSeason ? [...immediate, ...bareroot] : immediate;
}

/** Card label for a format under the chosen method. */
export function methodFormatLabel(
  method: FulfillmentMethod,
  tier: ShippingTier,
  computedLabel: string,
): string {
  if (tier === "bareroot") return "Bareroot pre-order";
  if (method === "ship") return "Peat & bagged";
  return computedLabel;
}
