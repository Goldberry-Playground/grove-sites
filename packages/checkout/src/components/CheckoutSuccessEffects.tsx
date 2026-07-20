"use client";

import { useEffect, useRef } from "react";
import { useCart } from "../cart-store";
import { CHECKOUT_HANDOFF_COOKIE } from "../checkout-handoff";

/**
 * Post-payment client effects for the order-confirmation page: empties the cart
 * (payment succeeded, so the ordered items are done) and expires the one-shot
 * hand-off cookie so a later visit to /checkout/success doesn't re-show a stale
 * order. Runs once. Renders nothing.
 */
export function CheckoutSuccessEffects(): null {
  const { clear } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    clear();
    document.cookie = `${CHECKOUT_HANDOFF_COOKIE}=; path=/checkout; max-age=0; SameSite=Lax`;
  }, [clear]);

  return null;
}
