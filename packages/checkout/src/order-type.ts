import type { ShipWave } from "@grove/odoo-client";
import type { OrderKind } from "./cart-reducer";
import type { CartDepositQuote } from "./hooks/useCartDepositQuote";

export const MIXED_CART_MESSAGE =
  "Pre-orders check out on their own. Remove the trees that ship now, or check them out first.";

/** Shown (and submit blocked) when a pre-order cart's deposit is not confirmed
 *  by the backend for the cart's wave (see {@link preorderDepositConfirmed}). */
export const PREORDER_DEPOSIT_UNCONFIRMED_MESSAGE =
  "We could not confirm your pre-order deposit. Please try again shortly.";

/**
 * True only when the BACKEND confirmed this pre-order cart charges the $10
 * deposit for the same wave: the settled quote says `depositNow`, echoes
 * `shipWave`, and is not the storefront's catalog estimate (`estimated`).
 *
 * Guards a new storefront against an older backend that ignores `ship_wave`
 * (its quote echoes no wave, so `shipWave` is null): the page would say "$10
 * deposit" while Stripe charged in full. The quote route's fallback estimate is
 * display-only, so it never confirms a pre-order either.
 */
export function preorderDepositConfirmed(quote: CartDepositQuote | null, wave: ShipWave | null): boolean {
  return (
    quote != null &&
    wave != null &&
    quote.depositNow === true &&
    quote.estimated !== true &&
    quote.shipWave === wave
  );
}

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
  /** Farm pickup; null when the fulfillment is not known yet (the cart page),
   *  which reads neutrally so a pickup order is never told its trees ship. */
  pickup: boolean | null;
}): string | null {
  const balance =
    opts.pickup === null ? "your trees ship or when you pick up" : opts.pickup ? "you pick up" : "your trees ship";
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
