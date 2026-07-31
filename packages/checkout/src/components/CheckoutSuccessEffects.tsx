"use client";

import { useEffect, useRef } from "react";
import { useCart } from "../cart-store";
import { CHECKOUT_HANDOFF_COOKIE } from "../checkout-handoff";

/**
 * Post-payment client effects for the order-confirmation page: empties the cart
 * (payment succeeded, so the ordered items are done) and expires the one-shot
 * hand-off cookie so a later visit to /checkout/success doesn't re-show a stale
 * order. Runs once (after cart hydration). Renders nothing.
 *
 * GOL-1039: this component renders *inside* CartProvider, so on mount React
 * flushes this child effect BEFORE the provider's own rehydrate effect. The old
 * code called `clear()` immediately, which set in-memory items to []; then the
 * provider's effect ran `setItems(loadFromStorage())` and repopulated the cart
 * from localStorage — so the cart survived a successful payment. We now gate the
 * clear on `hydrated`: the provider flips it true only after it has loaded
 * localStorage, so our `clear()` (and the resulting persist of []) is the last
 * write and actually wins.
 */
export function CheckoutSuccessEffects(): null {
  const { clear, hydrated } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (!hydrated || done.current) return;
    done.current = true;
    clear();
    document.cookie = `${CHECKOUT_HANDOFF_COOKIE}=; path=/checkout; max-age=0; SameSite=Lax`;
  }, [hydrated, clear]);

  return null;
}
