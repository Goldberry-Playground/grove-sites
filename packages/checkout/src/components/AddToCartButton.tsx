"use client";

import { trackAddToCart } from "@grove/analytics";
import { AddToCartButton as UIAddToCartButton } from "@grove/ui-kit";
import { useCart } from "../cart-store";

type AddToCartButtonProps = {
  variantId: number;
  templateId: number;
  name: string;
  price: number;
  imageUrl: string;
  disabled: boolean;
  /** Idle CTA label (e.g. "Reserve" for preorder formats). Defaults to "Add to Cart". */
  idleLabel?: string;
  /** Controlled quantity — lift it into the page to share with a sticky bar
   *  (GOL-1055). Pass with `onQuantityChange`; omit both for a self-contained
   *  stepper. */
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
};

/**
 * Cart-connected AddToCartButton. The presentational stepper + button live in
 * `@grove/ui-kit`; this wrapper binds them to the cart store: on add it writes
 * the line, fires analytics, and opens the mini-cart drawer.
 */
export function AddToCartButton({
  variantId,
  templateId,
  name,
  price,
  imageUrl,
  disabled,
  idleLabel,
  quantity,
  onQuantityChange,
}: AddToCartButtonProps) {
  const { add, openDrawer } = useCart();

  return (
    <UIAddToCartButton
      disabled={disabled}
      idleLabel={idleLabel}
      quantity={quantity}
      onQuantityChange={onQuantityChange}
      onAddToCart={(quantity) => {
        add({ variantId, templateId, name, price, imageUrl }, quantity);
        trackAddToCart({ variantId, price, quantity });
        // Open the mini-cart to confirm the add — a clear visual of what landed
        // in the cart plus a one-click path to checkout.
        openDrawer(variantId);
      }}
    />
  );
}
