"use client";

import type React from "react";
import { useRef, useState } from "react";
import { trackBeginCheckout } from "@grove/analytics";
import type { CheckoutSession, PromoPreview, ShipWave } from "@grove/odoo-client";
import type { CartTiers } from "../hooks/useTierNudge";
import {
  Button,
  CheckoutPage as UICheckoutPage,
  CheckoutReview,
  type GroveCheckoutOrder,
  type GroveFulfillment,
  type GrovePromoPreview,
} from "@grove/ui-kit";
import { orderKind, orderSeed, orderWave, unconfirmedSeedMove, type CartItem } from "../cart-reducer";
import { useCart } from "../cart-store";
import {
  PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE,
  depositConfirmedFor,
  mixedCartMessage,
  orderTypeLine,
} from "../order-type";
import { BRAND_TRUST, type GroveBrand } from "../brand-trust";
import { dueTodayFor } from "../due-today";
import { quotableState, quotableZip, useCartDepositQuote } from "../hooks/useCartDepositQuote";
import { useSeedHarvestSync } from "../hooks/useSeedHarvestSync";
import { useTierNudge } from "../hooks/useTierNudge";
import { seedHarvestConfirmLabel, seedHarvestMovedMessage } from "../seed";
import { tierFor, tierLabel } from "../tier-nudge";
import { WithGroveNext } from "./grove-next-seam";
import { CHECKOUT_HANDOFF_COOKIE, encodeHandoff } from "../checkout-handoff";
import { SEED_SHIP_TO_STATES, SHIP_TO_STATES, SHIP_TO_COUNTRIES, US_SHIP_TO_STATES } from "../ship-to-states";

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
 * Shown on a live-shipping (Printify) checkout when the destination is complete
 * but no carrier amount arrived: the quote failed, or the backend answered
 * without one. Same words as the backend's own 503 so the shopper sees one
 * message whichever side gave up. No price is ever shown in its place.
 */
export const LIVE_SHIPPING_UNAVAILABLE_MESSAGE =
  "Shipping is temporarily unavailable. Try again in a few minutes.";

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

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
  shipStateNotice,
  liveShipping = false,
}: {
  brand?: GroveBrand;
  depositQuoteHref?: string;
  /**
   * Shipping is a live carrier quote from `depositQuoteHref`, not "On the next
   * step" (the farm's Printify shirts, GOL-3315). The summary's shipping row
   * shows the quoted amount once state and ZIP are typed, "Enter your address"
   * before that, and submit stays blocked until an amount exists, so a shirt
   * order never starts on a guessed price. Default off: nursery and woodworking
   * are unchanged.
   */
  liveShipping?: boolean;
  /** Storefront `/api/checkout/promo` route — enables the promo Apply button
   *  and the automatic volume-discount row (GOL-2432). */
  promoPreviewHref?: string;
  /** Storefront `/api/cart/tiers` route — enables the volume nudge line. */
  tiersHref?: string;
  /**
   * Destination-specific notice for the chosen ship-to state, rendered by the kit
   * under the address (GOL-3028). Receives the state and the cart lines so a
   * storefront can key it on a line flag — the nursery keys it on
   * `consultBuilt` to disclose that a consult-built mix is constrained for that
   * destination BEFORE the deposit is charged. Return `null` for nothing.
   *
   * The claim lives in the storefront, not here: only a brand knows its own
   * plant-health carve-outs, and `@grove/checkout` is shared with storefronts
   * that ship no living plants at all.
   */
  shipStateNotice?: (
    state: string,
    items: readonly CartItem[],
  ) => React.ReactNode;
} = {}) {
  const { items, hydrated, subtotal, setWave, moveSeedHarvest, confirmSeedHarvest } = useCart();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // The last order we handed to the session route, kept so a Review & pay → back
  // round-trip re-seeds the form instead of clearing every field (GOL-3648).
  const [lastOrder, setLastOrder] = useState<GroveCheckoutOrder | null>(null);
  // Mirrors the form's ship/pickup radio so the "due today" quote follows the
  // buyer's choice (pickup changes the charge rule after the season cutover).
  const [chosenFulfillment, setChosenFulfillment] = useState<GroveFulfillment>("ship");
  // Pickup availability + copy ride the brand seam: only brands with a physical
  // pickup point (nursery) offer it, and each carries its own product-true copy
  // so the shared kit never shows a live-tree/WV claim on woodwork or pantry
  // goods (GOL-1314).
  const pickup = BRAND_TRUST[brand].pickup;
  // A farm-pickup-only line (GOL-2587 P1, rendered GOL-2588) makes the WHOLE
  // order pickup: grove_headless rejects a SHIP order containing one with a plain
  // 400, so offering shipping here would only collect a full address and then
  // refuse it. The flag is stamped on the cart line at add time, so the form needs
  // no product re-fetch. Gated on a pickup-capable brand (a null `pickup` has
  // nothing to lock to) and on `hydrated`, since an un-hydrated cart is [] and
  // `some()` would read "shippable" for a cart that is about to be pickup-only.
  const lockedToPickup =
    pickup !== null && hydrated && items.some((i) => i.pickupOnly === true);
  // The effective choice: the lock wins, so every downstream consumer (the
  // deposit quote, the promo preview, the order payload) sees the same answer the
  // form shows. Derived, never seeded into state, so a line added in another tab
  // can't leave a stale "ship" behind.
  const fulfillment: GroveFulfillment = lockedToPickup ? "pickup" : chosenFulfillment;
  // The ship-to ZIP as typed. The quote validates a pre-order wave against the
  // destination's USDA zone, so sending it surfaces a closed wave here, next to
  // a fix, instead of as a refusal at "Continue to payment" (GOL-3194).
  const [shippingZip, setShippingZip] = useState("");
  // The ship-to state, so a Printify cart is quoted live per destination (GOL-3315).
  const [shippingState, setShippingState] = useState("");
  const orderTypeRef = useRef<HTMLParagraphElement | null>(null);
  // What the cart charges today under the flat-deposit rule (GOL-2233), quoted
  // from the storefront's `/api/cart/quote` when wired; null = charged in full.
  // One wave per order, never mixed with immediate items (the PDP prevents it;
  // a stale localStorage cart can still hold a mix). `shipWave` is the cart's
  // single wave, null for an immediate cart.
  const kind = orderKind(items);
  const shipWave = orderWave(items);
  const mixedCart = hydrated && kind === "mixed";
  const {
    quote: depositQuote,
    settled: depositSettled,
    error: quoteError,
    failed: quoteFailed,
    alternateWave,
  } = useCartDepositQuote(depositQuoteHref, items, fulfillment, shipWave, shippingZip, shippingState);
  // The backend refused this wave for the destination but confirmed the other
  // one quotes: offer the switch. Hidden once the cart already holds that wave
  // (the re-quote is in flight and the stale refusal has not cleared yet).
  const switchWave =
    hydrated && kind === "preorder" && quoteError !== null && alternateWave !== null && alternateWave !== shipWave
      ? alternateWave
      : null;

  function switchOrderWave(wave: ShipWave) {
    setWave(wave);
    // The button unmounts with the refusal; land focus on the order line, which
    // now names the new wave, rather than dropping it to <body>.
    orderTypeRef.current?.focus();
  }
  // A seed cart follows the harvest year the backend quotes NOW (spec §6): the
  // season may have closed or filled between add-to-cart and checkout, and the
  // $1 then reserves next fall's harvest. The lines move to the quoted year and
  // checkout holds until the shopper confirms the change.
  useSeedHarvestSync({ kind, items, quote: depositQuote, settled: depositSettled, onMove: moveSeedHarvest });
  const seedMove = hydrated ? unconfirmedSeedMove(items) : null;
  function confirmSeedMove() {
    confirmSeedHarvest();
    orderTypeRef.current?.focus();
  }
  // A pre-order may only start a session once the BACKEND has confirmed the $10
  // deposit for this wave. An older backend ignores `ship_wave` and would charge
  // in full under a "$10 deposit" page; the quote route's catalog fallback is
  // display-only. Submit stays off while the quote is in flight; the message
  // shows once it has landed (or failed) without that confirmation.
  // A seed cart waits the same way on the backend confirming its $1 seed deposit.
  const preorderCart = hydrated && (kind === "preorder" || kind === "seed");
  const preorderUnconfirmed =
    preorderCart && quoteError === null && !depositConfirmedFor(kind, depositQuote, shipWave);
  const showPreorderUnconfirmed = preorderUnconfirmed && (depositSettled || quoteFailed);
  // The last confirmed quote persists until the next one lands, so a shopper who
  // completes the ZIP and submits inside the debounce would otherwise submit on
  // the ZIP-less quote and meet the closed-wave refusal at the session instead
  // of here (GOL-3194). A pre-order waits for the quote of its current inputs.
  const preorderQuotePending = preorderCart && !depositSettled;
  // Live carrier shipping (GOL-3315): the farm opts in, and any cart the backend
  // reports as Printify is treated the same way. The amount counts only once the
  // quote for the CURRENT destination has landed, so a shopper who changes state
  // after a quote cannot submit on the previous destination's price.
  const printifyQuote = depositQuote?.fulfillmentRoute === "printify";
  const needsLiveShipping = liveShipping || printifyQuote;
  const destinationKnown =
    fulfillment === "ship" && quotableZip(shippingZip) !== null && quotableState(shippingState) !== null;
  const liveShippingAmount =
    needsLiveShipping && depositSettled && depositQuote?.shippingAmount != null ? depositQuote.shippingAmount : null;
  // Address complete, quote finished (failed, or refused with a message),
  // still no carrier figure.
  const liveShippingUnavailable =
    needsLiveShipping &&
    destinationKnown &&
    liveShippingAmount === null &&
    (depositSettled || quoteFailed || quoteError !== null);
  const shippingValue = !needsLiveShipping
    ? undefined
    : liveShippingAmount !== null
      ? formatPrice(liveShippingAmount)
      : !destinationKnown
        ? "Enter your address"
        : liveShippingUnavailable
          ? "Unavailable"
          : "Checking…";
  const blocked =
    mixedCart ||
    quoteError !== null ||
    preorderUnconfirmed ||
    preorderQuotePending ||
    seedMove !== null ||
    (needsLiveShipping && liveShippingAmount === null);
  const dueToday = dueTodayFor(depositQuote, { subtotal });
  // Deposit/preorder carts get no discount (CEO directive, GOL-2088), so they
  // get no "unlock 10% off" promise either. Only reveal the nudge once the quote
  // confirms a charged-in-full cart — a still-loading or failed quote leaves the
  // charge mode unknown, and we must not flash a discount promise on what may be
  // a reservation cart.
  const { nudge, tiers } = useTierNudge(tiersHref, items, {
    hidden: !(depositSettled && !depositQuote?.depositNow) || kind === "preorder" || kind === "seed" || kind === "mixed",
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
        ...(shipWave ? { shipWave } : {}),
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
          // The pre-order wave (one per order); null for an immediate order.
          shipWave,
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
    // Remember what we submitted so "Edit contact or shipping" on the review
    // step comes back to a filled form, not a blank one (GOL-3648).
    setLastOrder(order);
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

  const orderTypeText = orderTypeLine({
    kind,
    wave: shipWave,
    depositNow: depositQuote?.depositNow === true,
    pickup: fulfillment === "pickup",
    seed: orderSeed(items),
    // A live-shipping storefront sells Printify shirts only, so the line reads
    // printed-to-order even before (or without) a quote; elsewhere the backend
    // decides.
    route: depositQuote?.fulfillmentRoute ?? (liveShipping ? "printify" : null),
  });
  const blockingMessage = mixedCart
    ? mixedCartMessage(items)
    : quoteError ??
      (showPreorderUnconfirmed
        ? PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE
        : liveShippingUnavailable
          ? LIVE_SHIPPING_UNAVAILABLE_MESSAGE
          : null);

  // The order type and the seed-harvest-move disclosure stay in the page-grid
  // notice under the title. The submit-blocking REFUSAL does not: it moves to
  // `blockingMessage` (the sticky-banner alert) and its one-click fix to
  // `blockingAction` (beside the Fulfillment control), so a phone shopper sees
  // why the CTA is greyed and how to fix it without scrolling back up (GOL-3648).
  const notice =
    orderTypeText || seedMove ? (
      <>
        {orderTypeText ? (
          <p
            ref={orderTypeRef}
            tabIndex={-1}
            aria-live="polite"
            className="grove-checkout__order-type"
            data-testid="order-type"
          >
            {orderTypeText}
          </p>
        ) : null}
        {seedMove ? (
          <>
            <p role="alert" className="grove-checkout__order-blocked" data-testid="seed-harvest-moved">
              {seedHarvestMovedMessage(seedMove)}
            </p>
            <div className="grove-checkout__wave-switch">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="grove-checkout__wave-switch-button"
                onClick={confirmSeedMove}
              >
                {seedHarvestConfirmLabel(seedMove)}
              </Button>
            </div>
          </>
        ) : null}
      </>
    ) : null;
  const blockingAction = switchWave ? (
    <div className="grove-checkout__wave-switch">
      <Button
        type="button"
        variant="primary"
        size="md"
        className="grove-checkout__wave-switch-button"
        onClick={() => switchOrderWave(switchWave)}
      >
        Switch this order to the {switchWave} wave
      </Button>
      <p className="grove-checkout__wave-switch-note">
        Every tree in this order moves to the {switchWave} wave. The deposit stays $10.
      </p>
    </div>
  ) : null;

  return (
    <WithGroveNext>
      <UICheckoutPage
        items={items}
        subtotal={subtotal}
        loading={!hydrated}
        onPlaceOrder={createSession}
        // Seeds are not living trees: a seed-only cart may ship to the lower 48
        // plus DC, never Hawaii or Alaska (Josh, 2026-10-13). Tree carts keep the
        // nursery licence list. The backend enforces the same split (GOL-3257).
        // A live-shipping (Printify) cart goes to all 50 states and DC (Josh,
        // 2026-10-13, GOL-3315); seeds to the lower 48 plus DC; trees keep the
        // nursery licence list.
        shipStates={liveShipping ? US_SHIP_TO_STATES : kind === "seed" ? SEED_SHIP_TO_STATES : SHIP_TO_STATES}
        shipStatesNote={
          // Nursery voices its live-tree routing; the kit's neutral default
          // covers every other brand so no false "live trees" claim leaks
          // (GOL-1314).
          liveShipping
            ? () => "We ship shirts to all 50 states and Washington, DC."
            : kind === "seed"
              ? () => "We ship seeds to the lower 48 states and Washington, DC. We can't ship seeds to Hawaii or Alaska."
              : brand === "nursery"
                ? (n) =>
                    `We currently ship live trees to ${n} states. Don't see yours? It's not on our route yet.`
                : undefined
        }
        countries={SHIP_TO_COUNTRIES}
        allowPickup={pickup !== null}
        pickupCopy={pickup ?? undefined}
        forcePickup={lockedToPickup}
        forcePickupNote={BRAND_TRUST[brand].pickupOnlyNote ?? undefined}
        // FLATWOODS runs on the nursery storefront only (GOL-2088). Other brands
        // keep the leaner form until they have a live promotion.
        allowPromoCode={brand === "nursery"}
        onApplyPromo={promoPreviewHref ? previewPromo : undefined}
        tierNudge={nudge?.message ?? null}
        paymentMethods={STRIPE_PAYMENT_METHOD}
        hidePaymentMethods
        // No arrow in this string: the CTA draws its own (GOL-3123). A typed
        // U+2192 here is what actually shipped to all three storefronts, since
        // this override, not grove-ui's default, is the label on screen.
        submitLabel="Continue to payment"
        submitPendingLabel="Starting secure checkout…"
        reassure="You'll review the amount and enter card details on Stripe's secure page. Nothing is charged until you confirm there."
        trustItems={kind === "seed" ? (BRAND_TRUST[brand].seedCheckout ?? BRAND_TRUST[brand].checkout) : BRAND_TRUST[brand].checkout}
        dueToday={dueToday}
        onFulfillmentChange={setChosenFulfillment}
        // Only ask for a notice once the cart is hydrated: an un-hydrated cart is
        // [] and would read "no consult-built line" for a cart that is about to
        // have one — the same trap `lockedToPickup` guards against above.
        shipStateNotice={
          shipStateNotice && hydrated
            ? (state) => shipStateNotice(state, items)
            : undefined
        }
        onShippingZipChange={setShippingZip}
        onShippingStateChange={setShippingState}
        shippingValue={shippingValue}
        readyEyebrow={needsLiveShipping ? "printed to order" : undefined}
        submitDisabled={blocked}
        notice={notice}
        blockingMessage={blockingMessage}
        blockingAction={blockingAction}
        initialContact={lastOrder?.contact}
        initialShipping={lastOrder?.shipping}
        initialFulfillment={lastOrder?.fulfillment}
        initialPromoCode={lastOrder?.promoCode}
      />
    </WithGroveNext>
  );
}
