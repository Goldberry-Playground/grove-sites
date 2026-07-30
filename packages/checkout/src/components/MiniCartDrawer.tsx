"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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

  // Collapse the drawer whenever the route changes (GOL-972). The drawer lives
  // in the persistent CartProvider above the router, so a client-side
  // navigation to /cart or /checkout would otherwise leave it open as an
  // overlay on top of the full cart/checkout page — forcing the user to click
  // "×" before they can reach the details form. Auto-closing on navigation
  // covers every entry point (mini-cart CTAs, header cart link, back button),
  // not just the two links that also call onClose for instant feedback.
  const pathname = usePathname();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    closeDrawer();
  }, [pathname, closeDrawer]);

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
