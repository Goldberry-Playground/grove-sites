import type { PromotionTier } from "@grove/odoo-client";

/** What the cart/checkout nudge line says, plus which tier state it is in. */
export interface TierNudge {
  /** `locked` = below the first tier; `partial` = a tier unlocked with a
   *  higher one left; `max` = the top tier is unlocked. */
  state: "locked" | "partial" | "max";
  message: string;
  /** Percent currently unlocked (0 when locked). */
  percent: number;
}

function trees(n: number): string {
  return n === 1 ? "1 more tree" : `${n} more trees`;
}

/**
 * The single nudge line for a cart holding `units` qualifying trees, against
 * the automatic volume tiers from the Odoo program (GOL-2432):
 *
 *   4 units, tiers 5/10 → "Add 1 more tree to unlock 10% off"
 *   5 units            → "10% off unlocked — add 5 more for 20%"
 *   10+ units          → "20% off unlocked"
 *
 * Returns null — no line at all — when there are no tiers (feed down, no live
 * program), the count is unknown, or the cart has no qualifying trees (a
 * supplies-only cart gets no tree nudge). `tiers` may arrive unsorted.
 */
export function tierNudgeFor(
  tiers: readonly PromotionTier[],
  units: number | null,
): TierNudge | null {
  if (units === null || !Number.isFinite(units) || units <= 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  if (sorted.length === 0) return null;

  const reached = sorted.filter((t) => units >= t.minQty);
  const current = reached[reached.length - 1] ?? null;
  const next = sorted.find((t) => units < t.minQty) ?? null;

  if (!current && next) {
    return {
      state: "locked",
      percent: 0,
      message: `Add ${trees(next.minQty - units)} to unlock ${next.percent}% off`,
    };
  }
  if (current && next) {
    return {
      state: "partial",
      percent: current.percent,
      message: `${current.percent}% off unlocked — add ${next.minQty - units} more for ${next.percent}%`,
    };
  }
  return current
    ? { state: "max", percent: current.percent, message: `${current.percent}% off unlocked` }
    : null;
}

/** "Volume discount (10% for 5+ trees)" — the summary row label. */
export function tierLabel(tier: { minQty: number; percent: number }): string {
  return `Volume discount (${tier.percent}% for ${tier.minQty}+ trees)`;
}

/** The highest tier `units` reaches, or null. */
export function tierFor(
  tiers: readonly PromotionTier[],
  units: number,
): PromotionTier | null {
  let best: PromotionTier | null = null;
  for (const t of tiers) if (units >= t.minQty && (!best || t.minQty > best.minQty)) best = t;
  return best;
}
