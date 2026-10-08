"use client";

import { trackAddToCart } from "@grove/analytics";
import { AddToCartButton as UIAddToCartButton } from "@grove/ui-kit";
import { useEffect, useState } from "react";
import type { ShipWave } from "@grove/odoo-client";
import { useCart } from "../cart-store";
import { canAdd } from "../cart-reducer";

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
  /**
   * The line being added is farm-pickup-only (GOL-2588). Stamped onto the cart
   * line so the checkout form can lock fulfillment to pickup without re-fetching
   * the product. Defaults to shippable.
   */
  pickupOnly?: boolean;
  /**
   * The line being added is a consult-built mix (GOL-3019). Stamped onto the cart
   * line so the checkout form can disclose the per-state species constraint
   * before the deposit is charged, without re-fetching the product (GOL-3028).
   */
  consultBuilt?: boolean;
  /**
   * Pre-order wave this add belongs to; omit for an immediate item. A cart is
   * either immediate or a pre-order for one wave, so an add that would mix them
   * (or add a second wave) is refused and the reason is shown inline.
   */
  wave?: ShipWave;
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
  pickupOnly,
  consultBuilt,
  wave,
}: AddToCartButtonProps) {
  const { items, add, openDrawer } = useCart();
  const [blocked, setBlocked] = useState<string | null>(null);
  // The refusal is stale once the shopper clears the cart or checks out.
  useEffect(() => {
    if (items.length === 0) setBlocked(null);
  }, [items.length]);

  return (
    <>
    {/* Refusal sits ABOVE the button, styled as an error (Josh 2026-10-07):
        the shopper reads why nothing was added before reaching for the CTA. */}
    {blocked ? (
      <p role="alert" className="grove-add-to-cart__blocked">
        {blocked}
      </p>
    ) : null}
    <UIAddToCartButton
      disabled={disabled}
      idleLabel={idleLabel}
      quantity={quantity}
      onQuantityChange={onQuantityChange}
      onAddToCart={(quantity) => {
        const verdict = canAdd(items, { wave });
        if (!verdict.ok) {
          setBlocked(verdict.message);
          return false;
        }
        setBlocked(null);
        add(
          { variantId, templateId, name, price, imageUrl, pickupOnly, consultBuilt, wave },
          quantity,
        );
        trackAddToCart({ variantId, price, quantity });
        // Open the mini-cart to confirm the add — a clear visual of what landed
        // in the cart plus a one-click path to checkout.
        openDrawer(variantId);
      }}
    />
    </>
  );
}
