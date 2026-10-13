import type { GroveDueToday } from "@grove/ui-kit";
import type { CartDepositQuote } from "./hooks/useCartDepositQuote";
import { formatDollars } from "./seed";

/**
 * Turn a cart deposit quote into the "due today" block the kit's cart and
 * checkout summaries render. Null when the cart charges in full (the summary
 * then shows its plain subtotal/total as before).
 *
 * Copy follows the GOL-2233 ruling and the product-page reserve note: ONE flat
 * $10 deposit per order, whatever is in the cart, balance at ship. Plain
 * factual sentences, no em dashes (brand voice rule).
 */
export function dueTodayFor(
  quote: CartDepositQuote | null,
  /** Cart goods subtotal, for the seed balance line ("$29.00 plus shipping"). */
  opts: { subtotal?: number } = {},
): GroveDueToday | null {
  if (!quote?.depositNow || quote.amountDueToday == null) return null;
  if (quote.depositReason === "seed") {
    const rest =
      opts.subtotal != null && opts.subtotal > quote.amountDueToday
        ? `${formatDollars(opts.subtotal - quote.amountDueToday)} plus shipping and tax is charged`
        : "The rest of the pack price, plus shipping and tax, is charged";
    return {
      amount: quote.amountDueToday,
      label: "Due today (seed deposit)",
      note: `This is a seed pre-order. You pay one flat ${formatDollars(quote.amountDueToday)} deposit today. ${rest} when your order ships.`,
      eyebrow: "seed pre-order",
    };
  }
  if (quote.depositReason === "preorder") {
    const wave = quote.shipWave ? `${quote.shipWave} wave ` : "";
    return {
      amount: quote.amountDueToday,
      label: "Due today (pre-order deposit)",
      note: `This is a ${wave}pre-order. You pay one flat $10 deposit today, no matter how many trees are in the order, and we charge the balance for trees, shipping and tax when your trees ship or you pick them up.`,
      eyebrow: "pre-order",
    };
  }
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
