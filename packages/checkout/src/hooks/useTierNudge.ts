"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@grove/analytics";
import type { PromotionTier } from "@grove/odoo-client";
import type { CartItem } from "../cart-reducer";
import { tierNudgeFor, type TierNudge } from "../tier-nudge";

/** The `/api/cart/tiers` answer: the automatic tiers + this cart's tree count. */
export interface CartTiers {
  tiers: PromotionTier[];
  /** Qualifying tree units in the cart; null when any line's count is unknown. */
  qualifyingUnits: number | null;
}

const DEBOUNCE_MS = 250;

function isCartTiers(value: unknown): value is CartTiers {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.tiers) && (v.qualifyingUnits === null || typeof v.qualifyingUnits === "number");
}

/**
 * Ask the storefront's `/api/cart/tiers` for the volume tiers and this cart's
 * qualifying tree count (debounced; stale answers discarded), and return the
 * cart/checkout nudge line (GOL-2432). Null — no line — while loading, when no
 * `href` is wired, when `hidden` (deposit/preorder carts get no discount, so
 * they get no nudge), or when the feed/count is unavailable.
 *
 * Fires the Plausible `tier_nudge_shown` event once per distinct message per
 * surface, so a quantity change that moves the buyer to a new tier counts, but
 * re-renders don't.
 */
export function useTierNudge(
  href: string | undefined,
  items: readonly CartItem[],
  { hidden = false, surface }: { hidden?: boolean; surface: "cart" | "checkout" },
): { nudge: TierNudge | null; tiers: CartTiers | null } {
  const [data, setData] = useState<CartTiers | null>(null);
  const key = JSON.stringify(
    items.map((i) => ({ variantId: i.variantId, templateId: i.templateId, quantity: i.quantity })),
  );

  useEffect(() => {
    if (!href || items.length === 0) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(href, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ variantId: i.variantId, templateId: i.templateId, quantity: i.quantity })),
          }),
          signal: controller.signal,
        });
        const body: unknown = res.ok ? await res.json() : null;
        setData(isCartTiers(body) ? body : null);
      } catch {
        if (!controller.signal.aborted) setData(null);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` captures the lines by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, key]);

  const nudge = hidden || !data ? null : tierNudgeFor(data.tiers, data.qualifyingUnits);

  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    if (!nudge || lastTracked.current === nudge.message) return;
    lastTracked.current = nudge.message;
    trackEvent("tier_nudge_shown", {
      surface,
      state: nudge.state,
      percent: nudge.percent,
      units: data?.qualifyingUnits ?? 0,
    });
  }, [nudge, surface, data?.qualifyingUnits]);

  return { nudge, tiers: data };
}
