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
  /** Idle CTA label (e.g. "Reserve" for preorder formats). Defaults to "Add to Cart". */
  idleLabel?: string;
  /** CSS selector of the inline Add-to-Cart region; see the kit component. */
  anchorSelector?: string;
  /**
   * Quantity to add on tap. Wire this to the inline stepper's current value so
   * the sticky bar adds the SAME quantity the shopper chose above, instead of
   * silently adding 1 (GOL-1055). Defaults to 1.
   */
  quantity?: number;
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
  idleLabel,
  anchorSelector,
  quantity = 1,
}: StickyAddToCartBarProps) {
  const { add, openDrawer, totalQuantity, hydrated } = useCart();
  // Never let a stray fractional/NaN quantity reach the cart from the bar.
  const addQuantity = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;

  return (
    <UIStickyAddToCartBar
      name={name}
      price={price}
      imageUrl={imageUrl}
      disabled={disabled}
      idleLabel={idleLabel}
      anchorSelector={anchorSelector}
      // Hide the badge until the cart is hydrated so SSR and first client render
      // agree (both show 0 → no badge).
      cartQuantity={hydrated ? totalQuantity : 0}
      onAdd={() => {
        add({ variantId, templateId, name, price, imageUrl }, addQuantity);
        openDrawer(variantId);
      }}
    />
  );
}
