import type { ShipWave } from "@grove/odoo-client";
import type { OrderKind } from "./cart-reducer";

export const MIXED_CART_MESSAGE =
  "Pre-orders check out on their own. Remove the trees that ship now, or check them out first.";

/**
 * The one-line order-type label shown on the cart and checkout. A legacy cart
 * (no wave on its lines) that the backend still prices as a deposit (off-season
 * bareroot) reads as a pre-order too, so the label never says "charged in full"
 * above a $10 deposit block. Null for an empty or mixed cart.
 */
export function orderTypeLine(opts: {
  kind: OrderKind;
  wave: ShipWave | null;
  depositNow: boolean;
  pickup: boolean;
}): string | null {
  const balance = opts.pickup ? "you pick up" : "your trees ship";
  if (opts.kind === "preorder") {
    return `Pre-order · ${opts.wave} wave · $10 deposit today, balance when ${balance}`;
  }
  if (opts.kind === "immediate") {
    return opts.depositNow
      ? `Pre-order · $10 deposit today, balance when ${balance}`
      : "Ships now or ready for pickup · charged in full";
  }
  return null;
}
