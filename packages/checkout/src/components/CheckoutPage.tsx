"use client";

import { useState } from "react";
import { trackBeginCheckout } from "@grove/analytics";
import type { CheckoutSession, PromoPreview } from "@grove/odoo-client";
import type { CartTiers } from "../hooks/useTierNudge";
import {
  CheckoutPage as UICheckoutPage,
  CheckoutReview,
  type GroveCheckoutOrder,
  type GroveFulfillment,
  type GrovePromoPreview,
} from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { BRAND_TRUST, type GroveBrand } from "../brand-trust";
import { dueTodayFor } from "../due-today";
import { useCartDepositQuote } from "../hooks/useCartDepositQuote";
import { useTierNudge } from "../hooks/useTierNudge";
import { tierFor, tierLabel } from "../tier-nudge";
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

/**
 * Map the backend preview to what the summary shows (GOL-2432). The backend
 * picks the single best discount; this only words the row:
 *   code → "FLATWOODS applied: −$10.00"
 *   tier → "Volume discount (10% for 5+ trees): −$xx.xx", plus the backend's
 *          reason line when the buyer typed a code the tier beat.
 */
export function toPromoPreview(
  preview: PromoPreview,
  typedCode: string | undefined,
  tiers: CartTiers | null,
): GrovePromoPreview {
  if (preview.applied === "code" && preview.discountAmount > 0) {
    const code = preview.code || typedCode || "Promo code";
    return { applied: true, discountAmount: preview.discountAmount, label: `${code} applied`, message: null };
  }
  if (preview.applied === "tier" && preview.discountAmount > 0) {
    const tier =
      preview.tier ??
      (tiers?.qualifyingUnits != null ? tierFor(tiers.tiers, tiers.qualifyingUnits) : null);
    return {
      applied: true,
      discountAmount: preview.discountAmount,
      label: tier ? tierLabel(tier) : "Volume discount",
      message: typedCode ? preview.message : null,
    };
  }
  return { applied: false, discountAmount: 0, label: "", message: preview.message };
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
export function CheckoutPage({
  brand = "nursery",
  depositQuoteHref,
  promoPreviewHref,
  tiersHref,
}: {
  brand?: GroveBrand;
  depositQuoteHref?: string;
  /** Storefront `/api/checkout/promo` route — enables the promo Apply button
   *  and the automatic volume-discount row (GOL-2432). */
  promoPreviewHref?: string;
  /** Storefront `/api/cart/tiers` route — enables the volume nudge line. */
  tiersHref?: string;
} = {}) {
  const { items, hydrated, subtotal } = useCart();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // Mirrors the form's ship/pickup radio so the "due today" quote follows the
  // buyer's choice (pickup changes the charge rule after the season cutover).
  const [fulfillment, setFulfillment] = useState<GroveFulfillment>("ship");
  // What the cart charges today under the flat-deposit rule (GOL-2233), quoted
  // from the storefront's `/api/cart/quote` when wired; null = charged in full.
  const { quote: depositQuote, settled: depositSettled } = useCartDepositQuote(
    depositQuoteHref,
    items,
    fulfillment,
  );
  const dueToday = dueTodayFor(depositQuote);
  // Pickup availability + copy ride the brand seam: only brands with a physical
  // pickup point (nursery) offer it, and each carries its own product-true copy
  // so the shared kit never shows a live-tree/WV claim on woodwork or pantry
  // goods (GOL-1314).
  const pickup = BRAND_TRUST[brand].pickup;
  // Deposit/preorder carts get no discount (CEO directive, GOL-2088), so they
  // get no "unlock 10% off" promise either. Only reveal the nudge once the quote
  // confirms a charged-in-full cart — a still-loading or failed quote leaves the
  // charge mode unknown, and we must not flash a discount promise on what may be
  // a reservation cart.
  const { nudge, tiers } = useTierNudge(tiersHref, items, {
    hidden: !(depositSettled && !depositQuote?.depositNow),
    surface: "checkout",
  });

  async function previewPromo(
    code: string | undefined,
    { fulfillment: mode }: { fulfillment: GroveFulfillment },
  ): Promise<GrovePromoPreview> {
    const response = await fetch(promoPreviewHref!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        fulfillment: mode,
        promoCode: code,
      }),
    }).catch(() => {
      throw new Error("We couldn't check that code. Check your connection and try again.");
    });
    const data = await readJsonBody(response);
    if (!response.ok || !data) {
      // Client-safe backend refusals (e.g. a deposit cart) arrive as `{error}`.
      throw new Error(
        typeof data?.error === "string" ? data.error : "We couldn't check that code. Please try again.",
      );
    }
    return toPromoPreview(data as unknown as PromoPreview, code, tiers);
  }

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
          // Ship vs farm pickup, from the buyer's Fulfillment choice (GOL-1075).
          // On "ship" a valid ship-to state is required and the server prices a
          // shipment; on "pickup" the address is relaxed and the server settles
          // a $0-shipping WV pickup (WV tax applies).
          fulfillment: order.fulfillment,
          // Optional promo code (e.g. FLATWOODS). Applied + validated server-side
          // via sale_loyalty; an invalid/ineligible code fails the order with a
          // shopper-facing message shown in the form (GOL-2088).
          promoCode: order.promoCode,
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
        shipStatesNote={
          // Nursery voices its live-tree routing; the kit's neutral default
          // covers every other brand so no false "live trees" claim leaks
          // (GOL-1314).
          brand === "nursery"
            ? (n) =>
                `We currently ship live trees to ${n} states. Don't see yours? It's not on our route yet.`
            : undefined
        }
        countries={SHIP_TO_COUNTRIES}
        allowPickup={pickup !== null}
        pickupCopy={pickup ?? undefined}
        // FLATWOODS runs on the nursery storefront only (GOL-2088). Other brands
        // keep the leaner form until they have a live promotion.
        allowPromoCode={brand === "nursery"}
        onApplyPromo={promoPreviewHref ? previewPromo : undefined}
        tierNudge={nudge?.message ?? null}
        paymentMethods={STRIPE_PAYMENT_METHOD}
        hidePaymentMethods
        submitLabel="Continue to payment →"
        submitPendingLabel="Starting secure checkout…"
        reassure="You'll review the amount and enter card details on Stripe's secure page. Nothing is charged until you confirm there."
        trustItems={BRAND_TRUST[brand].checkout}
        dueToday={dueToday}
        onFulfillmentChange={setFulfillment}
      />
    </WithGroveNext>
  );
}
