import type { GroveDueToday } from "@grove/ui-kit";
import type { CartDepositQuote } from "./hooks/useCartDepositQuote";

/**
 * Turn a cart deposit quote into the "due today" block the kit's cart and
 * checkout summaries render. Null when the cart charges in full (the summary
 * then shows its plain subtotal/total as before).
 *
 * Copy follows the GOL-2233 ruling and the product-page reserve note: ONE flat
 * $10 deposit per order, whatever is in the cart, balance at ship. Plain
 * factual sentences, no em dashes (brand voice rule).
 */
export function dueTodayFor(quote: CartDepositQuote | null): GroveDueToday | null {
  if (!quote?.depositNow || quote.amountDueToday == null) return null;
  const lead =
    quote.depositReason === "sold-out"
      ? "A tree in your cart is sold out for now, so your whole order is a reservation."
      : "Bareroot planting season is closed for now, so your whole order is a reservation.";
  return {
    amount: quote.amountDueToday,
    label: "Due today (reservation deposit)",
    note: `${lead} You pay one flat $10 deposit today, no matter how many trees are in the order, and we charge the balance for trees, shipping and tax when your trees ship.`,
    eyebrow: "reservation",
  };
}
