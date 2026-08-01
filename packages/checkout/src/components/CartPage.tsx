"use client";

import { CartPage as UICartPage } from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { BRAND_TRUST, type GroveBrand } from "../brand-trust";
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
 */
export function CartPage({ brand = "nursery" }: { brand?: GroveBrand } = {}) {
  const { items, hydrated, setQuantity, remove, subtotal, totalQuantity } =
    useCart();

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
      />
    </WithGroveNext>
  );
}
