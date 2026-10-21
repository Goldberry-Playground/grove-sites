// The free 15-minute planting consult (GOL-3384, order-builder spec D.2).
//
// Odoo decides the offer: the checkout quote says `consultEligible` when the
// goods subtotal after promotions clears the threshold parameter (default
// $500) or a consult-built line is in the cart, and names the consult product's
// variant id (GOL-3541). The storefront never computes the threshold; it keeps
// one yes/no beside the cart (`consultRequested`, see `cart-store`) and puts the
// $0 line on the order at checkout when the quote still says yes. Pure helpers
// and copy live here so both pages and their tests share one rule.

import type { CartDepositQuote } from "./hooks/useCartDepositQuote";

/** Checkbox label, as written in spec D.2. */
export const CONSULT_LABEL = "Add a free 15-minute planting consult";

/** What the shopper is saying yes to, under the label. */
export const CONSULT_NOTE =
  "A short call with us about where and how to plant your order. The booking link comes with your order confirmation.";

/**
 * Shown once, after the quote dropped the offer for a cart that had it ticked
 * (the shopper removed a tree and the order fell below the threshold). Says
 * why without naming the figure: the threshold is an Odoo parameter.
 */
export const CONSULT_REMOVED_MESSAGE =
  "Your order no longer qualifies for the free planting consult, so we removed it.";

/** Product name (spec D.1), shown on the review step beside the goods. */
export const CONSULT_LINE_NAME = "Planting consult, 15 minutes";

/**
 * The consult variant to add when THIS quote offers the consult, else null.
 * Both halves must be present: an eligible quote with no variant id (a backend
 * that predates GOL-3541) offers nothing, since there is nothing to add.
 */
export function consultOfferedBy(quote: CartDepositQuote | null | undefined): number | null {
  if (!quote || quote.consultEligible !== true) return null;
  const id = quote.consultVariantId;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * The extra session line for a requested consult: exactly one unit of the
 * consult variant, and only while the current quote offers it. A request the
 * quote no longer backs sends nothing, so the backend's 400 on an ineligible
 * order is reserved for a true race, not the common path.
 */
export function consultSessionLine(
  requested: boolean,
  quote: CartDepositQuote | null | undefined,
): { variantId: number; quantity: 1 } | null {
  if (!requested) return null;
  const variantId = consultOfferedBy(quote);
  return variantId === null ? null : { variantId, quantity: 1 };
}
