"use client";

import { useEffect, useState } from "react";
import type { CartItem } from "../cart-reducer";

/** The subset of a `/api/cart/quote` response the summaries render. */
export interface CartDepositQuote {
  depositNow: boolean;
  depositReason: "sold-out" | "off-season" | null;
  amountDueToday: number | null;
}

export type QuoteFulfillment = "ship" | "pickup";

const DEBOUNCE_MS = 250;

function isQuote(value: unknown): value is CartDepositQuote {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return typeof q.depositNow === "boolean";
}

/**
 * Ask the storefront's `/api/cart/quote` what the cart charges today, so the
 * cart page and checkout form can show the flat reservation deposit before the
 * Stripe session exists (GOL-2233). Re-quotes whenever the lines or the
 * fulfillment choice change (debounced; stale responses are discarded).
 *
 * Returns `null` while loading, when no `href` is wired (brands without a
 * charge rule), for an empty cart, or if the quote fails. A failed quote
 * simply leaves the summary on its plain subtotal, which is what it showed
 * before this hook existed. The review step remains the authoritative figure.
 */
export function useCartDepositQuote(
  href: string | undefined,
  items: readonly CartItem[],
  fulfillment?: QuoteFulfillment,
): CartDepositQuote | null {
  const [quote, setQuote] = useState<CartDepositQuote | null>(null);
  // Serialize the inputs so the effect keys on cart CONTENT, not array identity.
  const key = JSON.stringify({
    items: items.map((i) => ({ variantId: i.variantId, templateId: i.templateId, quantity: i.quantity })),
    fulfillment: fulfillment ?? null,
  });

  useEffect(() => {
    if (!href || items.length === 0) {
      setQuote(null);
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
            fulfillment: fulfillment ?? null,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setQuote(null);
          return;
        }
        const data: unknown = await res.json();
        setQuote(isQuote(data) ? data : null);
      } catch {
        if (!controller.signal.aborted) setQuote(null);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` captures items + fulfillment by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, key]);

  return quote;
}
