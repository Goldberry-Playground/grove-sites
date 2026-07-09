"use client";

import { StickyAddToCartBar as UIStickyAddToCartBar } from "@grove/ui-kit";
import { useCart } from "../cart-store";

type StickyAddToCartBarProps = {
  variantId: number;
  templateId: number;
  name: string;
  price: number;
  imageUrl: string;
  disabled?: boolean;
  /** CSS selector of the inline Add-to-Cart region; see the kit component. */
  anchorSelector?: string;
};

/**
 * Cart-connected StickyAddToCartBar. The presentational bar (with its
 * IntersectionObserver reveal) lives in `@grove/ui-kit`; this wrapper supplies
 * the live cart count for the badge and performs the add on tap.
 */
export function StickyAddToCartBar({
  variantId,
  templateId,
  name,
  price,
  imageUrl,
  disabled,
  anchorSelector,
}: StickyAddToCartBarProps) {
  const { add, openDrawer, totalQuantity, hydrated } = useCart();

  return (
    <UIStickyAddToCartBar
      name={name}
      price={price}
      imageUrl={imageUrl}
      disabled={disabled}
      anchorSelector={anchorSelector}
      // Hide the badge until the cart is hydrated so SSR and first client render
      // agree (both show 0 → no badge).
      cartQuantity={hydrated ? totalQuantity : 0}
      onAdd={() => {
        add({ variantId, templateId, name, price, imageUrl }, 1);
        openDrawer(variantId);
      }}
    />
  );
}
