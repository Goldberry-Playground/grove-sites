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
}: AddToCartButtonProps) {
  const { add, openDrawer } = useCart();

  return (
    <UIAddToCartButton
      disabled={disabled}
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
