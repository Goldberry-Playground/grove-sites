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
import { BRAND_TRUST, type GroveBrand } from "../brand-trust";
import { dueTodayFor } from "../due-today";
import { useCartDepositQuote } from "../hooks/useCartDepositQuote";
import { useSeedHarvestSync } from "../hooks/useSeedHarvestSync";
import { useTierNudge } from "../hooks/useTierNudge";
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
 * the buyer to read the goods total as the charge.
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
  const { items, hydrated, setQuantity, remove, subtotal, totalQuantity, moveSeedHarvest, confirmSeedHarvest } =
    useCart();
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
  // "You will not be charged today" is false on a deposit cart ($1 seed, $10
  // tree), so it never renders there, not even while the quote is loading: the
  // trust strip's "No payment until we confirm" is the one claim (Josh,
  // 2026-10-13). A cart the quote has not yet confirmed as charged in full
  // stays silent too; only an affirmative full-charge quote earns the line.
  const chargedInFull = depositSettled && depositQuote?.depositNow !== true;
  const reassure =
    kind === "immediate" && !quoteError && chargedInFull ? undefined : null;
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
        trustItems={BRAND_TRUST[brand].cart}
        dueToday={dueToday}
        reassure={reassure}
        tierNudge={nudge?.message ?? null}
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
