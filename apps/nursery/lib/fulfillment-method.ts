import type { MonthDay, ShippingCalendar, ShippingTier } from "@grove/odoo-client";
import { monthDayOf } from "./fulfillment-mode";
import type { FulfillmentPref } from "./fulfillment-pref";

/**
 * Farm pickup vs Shipped, chosen BEFORE Format on the PDP (Josh 2026-10-07).
 *
 * Odoo holds one potted stock pool. Shipped, a potted tree leaves the pot at
 * packing and travels peat and bagged; picked up, it goes home in the pot. So
 * Shipped never offers a "Potted" card, and Farm pickup shows Potted only in the
 * potted season (feed `leafed_window`, prod May 1 to Oct 15). Outside it, both
 * methods fall to the bareroot variant, whose charge shape is still decided by
 * the GOL-2233 rule in `fulfillment-mode.ts`. Spec: vault "Grove Peat and Bagged
 * Shipping" plus the 2026-10-07 pickup/shipped ruling.
 */
export type FulfillmentMethod = FulfillmentPref;

/** Prod `leafed_window`, used only when the feed carries no calendar. */
export const POTTED_SEASON_FALLBACK: [MonthDay, MonthDay] = [
  [5, 1],
  [10, 15],
];

const ord = (md: MonthDay) => md[0] * 100 + md[1];

/** Is `date` (UTC month/day) inside the potted season, endpoints inclusive? */
export function isPottedSeason(date: Date, calendar?: ShippingCalendar | null): boolean {
  const [start, end] = calendar?.leafed_window ?? POTTED_SEASON_FALLBACK;
  const d = ord(monthDayOf(date));
  return d >= ord(start) && d <= ord(end);
}

/**
 * The Format values to render for `method`, in display order.
 *  - ship: every non-potted format; a potted-only product keeps its potted
 *    format in season (labelled peat and bagged) and offers nothing out of it.
 *  - pickup: potted formats in season while one is purchasable; otherwise the
 *    non-potted formats; a potted-only product keeps its potted format so the
 *    card can still say sold out.
 */
export function formatsForMethod(
  formats: string[],
  method: FulfillmentMethod,
  tierOf: (format: string) => ShippingTier,
  opts: { pottedSeason: boolean; isPurchasable: (format: string) => boolean },
): string[] {
  const potted = formats.filter((f) => tierOf(f) === "potted");
  const other = formats.filter((f) => tierOf(f) !== "potted");
  if (method === "ship") {
    if (other.length > 0) return other;
    return opts.pottedSeason ? potted : [];
  }
  if (opts.pottedSeason && potted.some(opts.isPurchasable)) return potted;
  return other.length > 0 ? other : potted;
}

/** Card label for a format under the chosen method. */
export function methodFormatLabel(
  method: FulfillmentMethod,
  tier: ShippingTier,
  computedLabel: string,
): string {
  if (method === "ship" && tier === "potted") return "Peat & bagged";
  if (method === "pickup" && tier === "bareroot") return "Bareroot pre-order";
  return computedLabel;
}
