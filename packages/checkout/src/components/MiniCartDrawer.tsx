"use client";

import { MiniCartDrawer as UIMiniCartDrawer } from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { WithGroveNext } from "./grove-next-seam";

/**
 * Cart-connected MiniCartDrawer. Mounted once per app inside `<CartProvider>`.
 * The presentational drawer lives in `@grove/ui-kit`; this wrapper subscribes to
 * the store and passes items/totals/open-state down. `open` is gated on
 * `hydrated` so the server never emits the drawer markup (no flash-of-empty).
 */
export function MiniCartDrawer() {
  const {
    items,
    hydrated,
    drawerOpen,
    closeDrawer,
    subtotal,
    totalQuantity,
    lastAddedVariantId,
  } = useCart();

  return (
    <WithGroveNext>
      <UIMiniCartDrawer
        open={hydrated && drawerOpen}
        items={items}
        subtotal={subtotal}
        totalQuantity={totalQuantity}
        lastAddedVariantId={lastAddedVariantId}
        onClose={closeDrawer}
      />
    </WithGroveNext>
  );
}
