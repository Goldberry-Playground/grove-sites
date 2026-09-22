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

/** A cart deposit quote plus whether we have a *definite* answer for it. */
export interface CartDepositQuoteState {
  /** The quote, or null while loading, on failure, or when no rule applies. */
  quote: CartDepositQuote | null;
  /**
   * True once the cart's charge mode is known for certain: a successful quote
   * landed, or there is no charge rule to quote (no `href`, empty cart). False
   * while a quote is in flight and — deliberately — if the quote *fails*, since
   * a failed quote leaves the charge mode unknown. Callers that must not make a
   * promise on an unknown cart (the discount nudge: a deposit cart earns no
   * discount, GOL-2088) gate on `settled && !quote?.depositNow` so they reveal
   * nothing until the cart is affirmatively a charged-in-full order.
   */
  settled: boolean;
}

/**
 * Ask the storefront's `/api/cart/quote` what the cart charges today, so the
 * cart page and checkout form can show the flat reservation deposit before the
 * Stripe session exists (GOL-2233). Re-quotes whenever the lines or the
 * fulfillment choice change (debounced; stale responses are discarded).
 *
 * `quote` is `null` while loading, when no `href` is wired (brands without a
 * charge rule), for an empty cart, or if the quote fails. A failed quote
 * simply leaves the summary on its plain subtotal, which is what it showed
 * before this hook existed. The review step remains the authoritative figure.
 *
 * `settled` distinguishes "we know the charge mode" from "still loading / the
 * quote failed" — both of which surface as a `null` quote but must be treated
 * differently by anything that promises a discount (see {@link CartDepositQuoteState}).
 */
export function useCartDepositQuote(
  href: string | undefined,
  items: readonly CartItem[],
  fulfillment?: QuoteFulfillment,
): CartDepositQuoteState {
  const [quote, setQuote] = useState<CartDepositQuote | null>(null);
  const [settled, setSettled] = useState(false);
  // Serialize the inputs so the effect keys on cart CONTENT, not array identity.
  const key = JSON.stringify({
    items: items.map((i) => ({ variantId: i.variantId, templateId: i.templateId, quantity: i.quantity })),
    fulfillment: fulfillment ?? null,
  });

  useEffect(() => {
    if (!href || items.length === 0) {
      // No charge rule to quote — a definite "no deposit", so callers may act.
      setQuote(null);
      setSettled(true);
      return;
    }
    // A fresh quote is in flight; hold any deposit-conditioned UI until it lands.
    setSettled(false);
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
          // Charge mode unknown — leave `settled` false so nudges stay closed.
          setQuote(null);
          return;
        }
        const data: unknown = await res.json();
        if (isQuote(data)) {
          setQuote(data);
          setSettled(true);
        } else {
          setQuote(null);
        }
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

  return { quote, settled };
}
