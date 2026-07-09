"use client";

import { CartPage as UICartPage } from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { WithGroveNext } from "./grove-next-seam";

/**
 * Cart-connected CartPage. The presentational page lives in `@grove/ui-kit`;
 * this wrapper feeds it the store's lines/totals and wires quantity/remove back
 * to the store. `loading` is the inverse of `hydrated`.
 */
export function CartPage() {
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
      />
    </WithGroveNext>
  );
}
