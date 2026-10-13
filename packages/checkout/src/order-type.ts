import type { ShipWave } from "@grove/odoo-client";
import type { CartItem, OrderKind } from "./cart-reducer";
import type { CartDepositQuote } from "./hooks/useCartDepositQuote";
import { SEED_DEPOSIT, SEED_MIXED_MESSAGE, type CartSeedReservation } from "./seed";

export const MIXED_CART_MESSAGE =
  "Pre-orders check out on their own. Remove the trees that ship now, or check them out first.";

/** The blocking message for a mixed cart: the seed wording when a seed line is
 *  part of the mix (GOL-3258), else the tree pre-order wording. */
export function mixedCartMessage(items: readonly CartItem[]): string {
  return items.some((i) => i.seed !== undefined) ? SEED_MIXED_MESSAGE : MIXED_CART_MESSAGE;
}

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
 * True only when the BACKEND confirmed this seed cart takes the $1 seed deposit
 * (GOL-3258): same reasoning as {@link preorderDepositConfirmed}. A backend that
 * predates seed pre-orders would quote the cart as charged in full while the
 * page says "$1 today", so checkout stays blocked until it says `seed`.
 */
export function seedDepositConfirmed(quote: CartDepositQuote | null): boolean {
  return (
    quote != null &&
    quote.depositNow === true &&
    quote.estimated !== true &&
    quote.depositReason === "seed"
  );
}

/**
 * Does this cart's kind need a backend-confirmed deposit before checkout, and
 * has it got one? Immediate carts never wait on it.
 */
export function depositConfirmedFor(
  kind: OrderKind,
  quote: CartDepositQuote | null,
  wave: ShipWave | null,
): boolean {
  if (kind === "seed") return seedDepositConfirmed(quote);
  if (kind === "preorder") return preorderDepositConfirmed(quote, wave);
  return true;
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
  /** The seed cart's harvest (GOL-3258); null for every other cart. */
  seed?: CartSeedReservation | null;
}): string | null {
  if (opts.kind === "seed" && opts.seed) {
    return `Seed pre-order · fall ${opts.seed.year} harvest · $${SEED_DEPOSIT} deposit today, the rest when it ships`;
  }
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
