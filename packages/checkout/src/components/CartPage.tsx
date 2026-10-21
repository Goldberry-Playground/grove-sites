"use client";

import { useRef } from "react";
import { Button, CartPage as UICartPage } from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { orderKind, orderSeed, orderWave, unconfirmedSeedMove } from "../cart-reducer";
import {
  PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE,
  depositConfirmedFor,
  mixedCartMessage,
  orderTypeLine,
} from "../order-type";
import { seedHarvestConfirmLabel, seedHarvestMovedMessage, seedLineNotes } from "../seed";
import { cartTrustItems, type GroveBrand } from "../brand-trust";
import { depositTodayLine, dueTodayFor } from "../due-today";
import { useCartDepositQuote } from "../hooks/useCartDepositQuote";
import { useConsultOffer } from "../hooks/useConsultOffer";
import { useSeedHarvestSync } from "../hooks/useSeedHarvestSync";
import { useTierNudge } from "../hooks/useTierNudge";
import { ConsultOffer } from "./ConsultOffer";
import { WithGroveNext } from "./grove-next-seam";

/**
 * Cart-connected CartPage. The presentational page lives in `@grove/ui-kit`;
 * this wrapper feeds it the store's lines/totals and wires quantity/remove back
 * to the store. `loading` is the inverse of `hydrated`.
 *
 * `brand` selects the trust strip so each storefront only makes claims true for
 * its products — the nursery's live-plant "arrive-alive" promise must not leak
 * onto GGG woodwork or goldberry pantry goods (GOL-1090). Defaults to
 * `nursery`, the only live purchasable surface today.
 *
 * `depositQuoteHref` (optional) points at the storefront's `/api/cart/quote`
 * route; when set, the summary shows the flat reservation deposit as "due
 * today" whenever the backend would charge one (GOL-2233) instead of leaving
 * the buyer to read the goods total as the charge. The same quote carries the
 * free planting-consult offer (GOL-3384): when it says the cart qualifies, a
 * checkbox under the totals lets the shopper add the $0 consult line.
 */
export function CartPage({
  brand = "nursery",
  depositQuoteHref,
  tiersHref,
}: {
  brand?: GroveBrand;
  depositQuoteHref?: string;
  /** Storefront `/api/cart/tiers` route — enables the volume-discount nudge
   *  ("Add 2 more trees to unlock 10% off", GOL-2432). */
  tiersHref?: string;
} = {}) {
  const {
    items,
    hydrated,
    setQuantity,
    remove,
    subtotal,
    totalQuantity,
    moveSeedHarvest,
    confirmSeedHarvest,
    consultRequested,
    setConsultRequested,
  } = useCart();
  const orderTypeRef = useRef<HTMLParagraphElement | null>(null);
  const kind = orderKind(items);
  const shipWave = orderWave(items);
  const mixedCart = hydrated && kind === "mixed";
  const {
    quote: depositQuote,
    settled: depositSettled,
    error: quoteError,
    failed: quoteFailed,
  } = useCartDepositQuote(depositQuoteHref, items, undefined, shipWave);
  // A seed cart follows the harvest year the backend quotes NOW, not the one
  // stamped at add time (spec §6); a move is shown until the shopper confirms.
  useSeedHarvestSync({ kind, items, quote: depositQuote, settled: depositSettled, onMove: moveSeedHarvest });
  // The free consult is offered by the quote, never computed here (spec D.2);
  // the hook drops a ticked consult, and says why, when the quote withdraws it.
  const consult = useConsultOffer(depositQuote, depositSettled, consultRequested, setConsultRequested);
  const seedMove = hydrated ? unconfirmedSeedMove(items) : null;
  function confirmSeedMove() {
    confirmSeedHarvest();
    // The notice unmounts; land focus on the order line, which names the new
    // harvest, rather than dropping it to <body>.
    orderTypeRef.current?.focus();
  }
  // The cart page has no ship / pickup choice yet: an all-pickup-only cart is
  // pickup, anything else reads neutrally (never "when your trees ship" for an
  // order that may be picked up).
  const allPickupOnly = items.length > 0 && items.every((i) => i.pickupOnly === true);
  const orderTypeText = orderTypeLine({
    kind,
    wave: shipWave,
    depositNow: depositQuote?.depositNow === true,
    pickup: allPickupOnly ? true : null,
    seed: orderSeed(items),
    route: depositQuote?.fulfillmentRoute ?? null,
  });
  // Same guard as the checkout form: a pre-order the backend has not confirmed
  // as a $10 deposit for this wave, or a seed cart not confirmed as the $1 seed
  // deposit (older backend, or the route's estimate).
  const preorderUnconfirmed =
    hydrated &&
    (kind === "preorder" || kind === "seed") &&
    quoteError === null &&
    (depositSettled || quoteFailed) &&
    !depositConfirmedFor(kind, depositQuote, shipWave);
  const blockingMessage = mixedCart
    ? mixedCartMessage(items)
    : quoteError ?? (preorderUnconfirmed ? PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE : null);
  const dueToday = dueTodayFor(depositQuote, { subtotal });
  // A deposit cart says what actually happens, "$1 today, the rest when it
  // ships." ($10 for a tree reservation), with the amount from the confirmed
  // quote, under the CTA and in the trust strip; "You will not be charged
  // today" and "No payment until we confirm" never render there, not even
  // while the quote is loading (Josh, 2026-10-13). A charged-in-full cart keeps
  // both, but only once an affirmative full-charge quote confirms it.
  const chargedInFull = depositSettled && depositQuote?.depositNow !== true;
  const depositKind = kind === "preorder" || kind === "seed";
  const reassure = dueToday
    ? depositTodayLine(dueToday.amount)
    : kind === "immediate" && !quoteError && chargedInFull
      ? undefined
      : null;
  const trustItems = cartTrustItems(brand, { amountDueToday: dueToday?.amount ?? null, depositKind });
  // Deposit carts get no discount, so no nudge (GOL-2088 / GOL-2432). Reveal the
  // nudge only once the quote confirms a charged-in-full cart — never while the
  // quote is loading or if it failed (both leave the charge mode unknown), so a
  // reservation cart can't flash a discount promise it will never honour.
  const { nudge } = useTierNudge(tiersHref, items, {
    hidden: !(depositSettled && !depositQuote?.depositNow) || kind === "preorder" || kind === "seed" || kind === "mixed",
    surface: "cart",
  });

  return (
    <WithGroveNext>
      <UICartPage
        items={items}
        subtotal={subtotal}
        totalQuantity={totalQuantity}
        loading={!hydrated}
        onSetQuantity={setQuantity}
        onRemove={remove}
        trustItems={trustItems}
        dueToday={dueToday}
        reassure={reassure}
        tierNudge={nudge?.message ?? null}
        summaryExtra={<ConsultOffer offer={consult} />}
        notice={
          orderTypeText || blockingMessage || seedMove ? (
            <>
              {orderTypeText ? (
                <p
                  ref={orderTypeRef}
                  tabIndex={-1}
                  className="grove-checkout__order-type"
                  data-testid="order-type"
                >
                  {orderTypeText}
                </p>
              ) : null}
              {blockingMessage ? (
                <p role="alert" className="grove-checkout__order-blocked">
                  {blockingMessage}
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
          ) : null
        }
        lineNotes={(item) => {
          const seed = items.find((i) => i.variantId === item.variantId)?.seed;
          return seed ? seedLineNotes(seed) : null;
        }}
      />
    </WithGroveNext>
  );
}
