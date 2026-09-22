"use client";

import { CartPage as UICartPage } from "@grove/ui-kit";
import { useCart } from "../cart-store";
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
  const dueToday = dueTodayFor(useCartDepositQuote(depositQuoteHref, items));
  // Deposit carts get no discount, so no nudge (GOL-2088 / GOL-2432).
  const { nudge } = useTierNudge(tiersHref, items, {
    hidden: dueToday !== null,
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
        tierNudge={nudge?.message ?? null}
      />
    </WithGroveNext>
  );
}
