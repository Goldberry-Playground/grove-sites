"use client";

import { useState } from "react";
import { trackBeginCheckout } from "@grove/analytics";
import type { CheckoutSession } from "@grove/odoo-client";
import {
  CheckoutPage as UICheckoutPage,
  CheckoutReview,
  type GroveCheckoutOrder,
} from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { WithGroveNext } from "./grove-next-seam";
import { CHECKOUT_HANDOFF_COOKIE, encodeHandoff } from "../checkout-handoff";
import { SHIP_TO_STATES, SHIP_TO_COUNTRIES } from "../ship-to-states";

const STRIPE_PAYMENT_METHOD = [
  { value: "card", label: "Pay by card — secure Stripe checkout" },
];

/**
 * Read a fetch Response as JSON without letting a non-JSON body blow up.
 *
 * The session route always answers `application/json` — on success and on
 * every handled error. But a request that never reaches the handler (a 404
 * for an undeployed route, a framework 500 page, a CDN/proxy 502) comes back
 * as HTML. Calling `response.json()` on that throws a raw
 * `JSON.parse: unexpected character` / `Unexpected token '<'` whose message
 * would otherwise surface verbatim in the buyer's checkout error box. Returns
 * the parsed object, or `null` when the body is empty or not JSON.
 */
async function readJsonBody(
  response: Response,
): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const CHECKOUT_ERROR =
  "We couldn't start secure checkout. Please try again.";

/**
 * Cart-connected checkout with the Stripe hand-off. Two phases:
 *
 *   1. Form — the presentational `@grove/ui-kit` CheckoutPage collects contact +
 *      shipping. Submitting POSTs the order to `/api/checkout/session`, which
 *      returns a CheckoutSession (order created in Odoo + Stripe session minted).
 *   2. Review — `CheckoutReview` shows the pay-today (deposit) vs due-at-shipping
 *      split so the buyer sees exactly what is charged *before* entering card
 *      details. "Pay with card" stashes the order hand-off in a cookie and
 *      redirects the browser to Stripe's hosted `checkoutUrl`.
 *
 * The cart is intentionally NOT cleared here — a cancelled payment must keep the
 * cart (see the cancel page). It's cleared on the success page after payment.
 */
export function CheckoutPage() {
  const { items, hydrated, subtotal } = useCart();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  async function createSession(order: GroveCheckoutOrder) {
    const totalQuantity = items.reduce((n, it) => n + it.quantity, 0);
    trackBeginCheckout({ itemCount: totalQuantity, subtotal });

    const origin = window.location.origin;
    let response: Response;
    try {
      response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: order.contact,
          shipping: order.shipping,
          billing: null,
          paymentMethod: "card",
          // The nursery form is ship-only today (a ship-to state is required),
          // so assert the shipment explicitly — the server then rejects a
          // missing state instead of settling it as a silent $0-ship pickup
          // (GOL-1057). A pickup toggle sends "pickup" when it lands.
          fulfillment: "ship",
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          successUrl: `${origin}/checkout/success`,
          cancelUrl: `${origin}/checkout/cancel`,
        }),
      });
    } catch {
      // fetch rejects before any response on a network failure / offline.
      throw new Error(
        "We couldn't reach secure checkout. Check your connection and try again.",
      );
    }

    // Tolerate a non-JSON body (HTML 404/500/proxy page) instead of leaking a
    // raw JSON.parse error to the buyer on the final checkout step.
    const data = await readJsonBody(response);
    if (!response.ok || !data) {
      const serverError = typeof data?.error === "string" ? data.error : null;
      throw new Error(serverError || CHECKOUT_ERROR);
    }

    setSession(data as unknown as CheckoutSession);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function payNow() {
    if (!session) return;
    setRedirecting(true);
    // Hand the order id + access token (already known) to the success page.
    const handoff = encodeHandoff({
      orderId: session.orderId,
      accessToken: session.accessToken,
      amountDueToday: session.amountDueToday,
      amountTotal: session.amountTotal,
      hasPreorder: session.hasPreorder,
      currency: session.currency,
    });
    document.cookie = `${CHECKOUT_HANDOFF_COOKIE}=${handoff}; path=/checkout; max-age=1800; SameSite=Lax`;
    window.location.assign(session.checkoutUrl);
  }

  if (session) {
    return (
      <WithGroveNext>
        <CheckoutReview
          items={items.map((i) => ({
            variantId: i.variantId,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
          }))}
          lineItems={session.lineItems}
          amountDueToday={session.amountDueToday}
          amountTotal={session.amountTotal}
          hasPreorder={session.hasPreorder}
          currency={session.currency}
          redirecting={redirecting}
          onPay={payNow}
          onBack={() => setSession(null)}
        />
      </WithGroveNext>
    );
  }

  return (
    <WithGroveNext>
      <UICheckoutPage
        items={items}
        subtotal={subtotal}
        loading={!hydrated}
        onPlaceOrder={createSession}
        shipStates={SHIP_TO_STATES}
        countries={SHIP_TO_COUNTRIES}
        paymentMethods={STRIPE_PAYMENT_METHOD}
        hidePaymentMethods
        submitLabel="Continue to payment →"
        submitPendingLabel="Starting secure checkout…"
        reassure="You'll review the amount and enter card details on Stripe's secure page. Nothing is charged until you confirm there."
        trustItems={[
          { icon: "✦", text: "Card entered on Stripe — never stored by us" },
          { icon: "◐", text: "Deposit today on preorders, balance at ship time" },
          { icon: "✓", text: "Satisfaction or refund" },
        ]}
      />
    </WithGroveNext>
  );
}
