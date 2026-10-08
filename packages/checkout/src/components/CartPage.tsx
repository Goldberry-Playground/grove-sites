"use client";

import { CartPage as UICartPage } from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { orderKind, orderWave } from "../cart-reducer";
import {
  MIXED_CART_MESSAGE,
  PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE,
  orderTypeLine,
  preorderDepositConfirmed,
} from "../order-type";
import { BRAND_TRUST, type GroveBrand } from "../brand-trust";
import { dueTodayFor } from "../due-today";
import { useCartDepositQuote } from "../hooks/useCartDepositQuote";
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
  const { items, hydrated, setQuantity, remove, subtotal, totalQuantity } =
    useCart();
  const kind = orderKind(items);
  const shipWave = orderWave(items);
  const mixedCart = hydrated && kind === "mixed";
  const {
    quote: depositQuote,
    settled: depositSettled,
    error: quoteError,
    failed: quoteFailed,
  } = useCartDepositQuote(depositQuoteHref, items, undefined, shipWave);
  // The cart page has no ship / pickup choice yet: an all-pickup-only cart is
  // pickup, anything else reads neutrally (never "when your trees ship" for an
  // order that may be picked up).
  const allPickupOnly = items.length > 0 && items.every((i) => i.pickupOnly === true);
  const orderTypeText = orderTypeLine({
    kind,
    wave: shipWave,
    depositNow: depositQuote?.depositNow === true,
    pickup: allPickupOnly ? true : null,
  });
  // Same guard as the checkout form: a pre-order the backend has not confirmed
  // as a $10 deposit for this wave (older backend, or the route's estimate).
  const preorderUnconfirmed =
    hydrated &&
    kind === "preorder" &&
    quoteError === null &&
    (depositSettled || quoteFailed) &&
    !preorderDepositConfirmed(depositQuote, shipWave);
  const blockingMessage = mixedCart
    ? MIXED_CART_MESSAGE
    : quoteError ?? (preorderUnconfirmed ? PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE : null);
  const dueToday = dueTodayFor(depositQuote);
  // Deposit carts get no discount, so no nudge (GOL-2088 / GOL-2432). Reveal the
  // nudge only once the quote confirms a charged-in-full cart — never while the
  // quote is loading or if it failed (both leave the charge mode unknown), so a
  // reservation cart can't flash a discount promise it will never honour.
  const { nudge } = useTierNudge(tiersHref, items, {
    hidden: !(depositSettled && !depositQuote?.depositNow) || kind === "preorder" || kind === "mixed",
    surface: "cart",
  });

  return (
    <WithGroveNext>
      {orderTypeText ? (
        <p className="grove-cart__order-type" data-testid="order-type">
          {orderTypeText}
        </p>
      ) : null}
      {blockingMessage ? (
        <p role="alert" className="grove-cart__order-blocked">
          {blockingMessage}
        </p>
      ) : null}
      <UICartPage
        items={items}
        subtotal={subtotal}
        totalQuantity={totalQuantity}
        loading={!hydrated}
        onSetQuantity={setQuantity}
        onRemove={remove}
        trustItems={BRAND_TRUST[brand].cart}
        dueToday={dueToday}
        tierNudge={nudge?.message ?? null}
      />
    </WithGroveNext>
  );
}
