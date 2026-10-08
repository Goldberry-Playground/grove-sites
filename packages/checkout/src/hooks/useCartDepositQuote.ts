"use client";

import { useEffect, useState } from "react";
import type { ShipWave } from "@grove/odoo-client";
import type { CartItem } from "../cart-reducer";

/** The subset of a `/api/cart/quote` response the summaries render. */
export interface CartDepositQuote {
  depositNow: boolean;
  depositReason: "sold-out" | "off-season" | "preorder" | null;
  shipWave?: ShipWave | null;
  amountDueToday: number | null;
  /** Set by the storefront quote route when the backend quote was unavailable
   *  and this is its own catalog estimate (display only, never confirms a
   *  pre-order deposit). Absent on a backend-confirmed quote. */
  estimated?: boolean;
}

export type QuoteFulfillment = "ship" | "pickup";

const DEBOUNCE_MS = 250;

/**
 * Shown when the quote refuses the cart (400) without a usable shopper-facing
 * reason. The session would be refused too, so the form blocks submit; this
 * says so instead of leaving a disabled button with no explanation.
 */
export const QUOTE_REFUSED_FALLBACK = "We couldn't confirm this order. Please review your cart and try again.";

/**
 * The 5-digit ZIP to quote with, or null while the field is empty or still
 * being typed. Keying the quote on this (not the raw field) means a shopper
 * typing "2", "26", "266"... re-quotes once, when the ZIP is complete.
 */
export function quotableZip(raw: string | null | undefined): string | null {
  const m = /^(\d{5})(?:-\d{4})?$/.exec((raw ?? "").trim());
  return m ? m[1] : null;
}

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
   * True once the cart's charge mode is known for certain FOR THE CURRENT
   * INPUTS: a successful quote landed for exactly these lines, fulfillment, wave
   * and ZIP, or there is no charge rule to quote (no `href`, empty cart). It
   * drops to false on the same render the inputs change (a newly completed ZIP,
   * a wave switch), so the last confirmed quote, which persists for display
   * until the next one lands, never reads as confirmed for inputs it was not
   * quoted on. False
   * while a quote is in flight and — deliberately — if the quote *fails*, since
   * a failed quote leaves the charge mode unknown. Callers that must not make a
   * promise on an unknown cart (the discount nudge: a deposit cart earns no
   * discount, GOL-2088) gate on `settled && !quote?.depositNow` so they reveal
   * nothing until the cart is affirmatively a charged-in-full order.
   */
  settled: boolean;
  /**
   * The backend's shopper-facing refusal (a 400 from the quote: mixed cart,
   * closed wave, potted line out of season), or null. The checkout form shows it
   * and blocks submit, because the session would be refused for the same reason.
   */
  error: string | null;
  /**
   * True when the last quote attempt failed without a shopper-facing reason (a
   * non-400 error, a malformed body, or a network failure), so the charge mode
   * is unknown and will stay unknown until the cart or fulfillment changes.
   */
  failed: boolean;
  /**
   * The wave the backend confirmed WOULD quote for this cart and destination
   * when it refused the cart's own wave (a fall pre-order past its zone's
   * order-by: GOL-3194). Set only alongside `error`; null otherwise. The
   * checkout offers it as a one-tap switch.
   */
  alternateWave: ShipWave | null;
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
  shipWave?: ShipWave | null,
  /** The destination ZIP as typed (ship only; ignored for pickup). Sent once
   *  it is a complete ZIP so a closed wave surfaces before submit (GOL-3194). */
  zip?: string | null,
): CartDepositQuoteState {
  const [quote, setQuote] = useState<CartDepositQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alternateWave, setAlternateWave] = useState<ShipWave | null>(null);
  // The input key the last definite answer was for; `settled` is derived from it
  // so a pending re-quote reads unsettled immediately, not one effect later.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // A pickup wave is judged on the farm's zone, so the ZIP only keys a ship quote.
  const destinationZip = fulfillment === "pickup" ? null : quotableZip(zip);
  // Serialize the inputs so the effect keys on cart CONTENT, not array identity.
  const key = JSON.stringify({
    items: items.map((i) => ({ variantId: i.variantId, templateId: i.templateId, quantity: i.quantity })),
    fulfillment: fulfillment ?? null,
    shipWave: shipWave ?? null,
    zip: destinationZip,
  });

  useEffect(() => {
    if (!href || items.length === 0) {
      // No charge rule to quote — a definite "no deposit", so callers may act.
      setQuote(null);
      setError(null);
      setAlternateWave(null);
      setFailed(false);
      setSettledKey(key);
      return;
    }
    // A fresh quote is in flight; hold any deposit-conditioned UI until it lands.
    setSettledKey(null);
    setFailed(false);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(href, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ variantId: i.variantId, templateId: i.templateId, quantity: i.quantity })),
            fulfillment: fulfillment ?? null,
            // Omitted for an immediate cart (absent = no wave).
            ...(shipWave ? { shipWave } : {}),
            ...(destinationZip ? { zip: destinationZip } : {}),
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          // Charge mode unknown — leave `settled` false so nudges stay closed.
          setQuote(null);
          // A 400 carries the backend's shopper-facing reason; show it.
          if (res.status === 400) {
            try {
              const body = (await res.json()) as { error?: unknown; alternateWave?: unknown };
              const message = typeof body.error === "string" && body.error ? body.error : null;
              setError(message ?? QUOTE_REFUSED_FALLBACK);
              setAlternateWave(
                message && (body.alternateWave === "fall" || body.alternateWave === "spring") && body.alternateWave !== shipWave
                  ? body.alternateWave
                  : null,
              );
            } catch {
              setError(QUOTE_REFUSED_FALLBACK);
              setAlternateWave(null);
            }
          } else {
            setError(null);
            setAlternateWave(null);
            setFailed(true);
          }
          return;
        }
        const data: unknown = await res.json();
        setAlternateWave(null);
        if (isQuote(data)) {
          setQuote(data);
          setError(null);
          setSettledKey(key);
        } else {
          setQuote(null);
          setFailed(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setQuote(null);
          setAlternateWave(null);
          setFailed(true);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` captures items + fulfillment + wave + ZIP by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, key]);

  return { quote, settled: settledKey === key, error, failed, alternateWave };
}
