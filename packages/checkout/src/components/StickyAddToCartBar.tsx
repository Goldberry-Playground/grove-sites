"use client";

import { StickyAddToCartBar as UIStickyAddToCartBar } from "@grove/ui-kit";
import { useEffect, useState } from "react";
import type { ShipWave } from "@grove/odoo-client";
import { useCart } from "../cart-store";
import { canAdd } from "../cart-reducer";
import type { CartSeedReservation } from "../seed";

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
  /** Pre-order wave this add belongs to; omit for an immediate item. See AddToCartButton. */
  wave?: ShipWave;
  /**
   * Seed pre-order harvest this add reserves from (GOL-3258); omit for a tree.
   * Seeds check out on their own, one harvest year per order, so a mixing add
   * is refused inline like a second wave.
   */
  seed?: CartSeedReservation;
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
  pickupOnly,
  consultBuilt,
  wave,
  seed,
}: StickyAddToCartBarProps) {
  const { items, add, openDrawer, totalQuantity, hydrated } = useCart();
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => {
    if (items.length === 0) setBlocked(null);
  }, [items.length]);
  // Never let a stray fractional/NaN quantity reach the cart from the bar.
  const addQuantity = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;

  return (
    <>
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
        const verdict = canAdd(items, { wave, seed });
        if (!verdict.ok) {
          setBlocked(verdict.message);
          return;
        }
        setBlocked(null);
        add(
          { variantId, templateId, name, price, imageUrl, pickupOnly, consultBuilt, wave, seed },
          addQuantity,
        );
        openDrawer(variantId);
      }}
    />
    {blocked ? (
      <p role="alert" className="grove-sticky-add__blocked">
        {blocked}
      </p>
    ) : null}
    </>
  );
}
