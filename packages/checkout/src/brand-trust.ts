import type { GroveTrustItem, GrovePickupCopy } from "@grove/ui-kit";
import { depositTodayLine } from "./due-today";

/**
 * Which storefront is rendering the shared cart/checkout. The three apps that
 * consume `@grove/checkout` each pass their own brand so the trust strip tells
 * the truth for *their* products — a live-plant promise on a woodworking or
 * pantry-goods storefront is a false claim, not a stylistic choice
 * (GOL-1090, spun out of the GOL-1058 payment-copy truth pass).
 */
export type GroveBrand = "nursery" | "ggg" | "goldberry";

interface BrandTrust {
  /** Cart-page strip (four signals). */
  cart: GroveTrustItem[];
  /** Checkout-page strip (three signals; leads with the Stripe assurance). */
  checkout: GroveTrustItem[];
  /**
   * Checkout strip for a SEED-only cart (GOL-3258): the tree strip names a $10
   * deposit, and a seed order takes $1. Optional; a brand without seeds falls
   * back to `checkout`.
   */
  seedCheckout?: GroveTrustItem[];
  /**
   * Farm-pickup fulfillment. `null` for brands with no pickup location — the
   * checkout renders ship-only and never shows a pickup option. Only the
   * nursery has a physical West Virginia pickup point, and its copy names live
   * trees + a WV tax jurisdiction, so this must ride the brand seam rather than
   * default on in the shared kit (GOL-1075 shipped pickup; GOL-1314 stopped it
   * leaking onto ggg/goldberry). The copy is the single source of truth for the
   * ship-vs-pickup fieldset wording.
   */
  pickup: GrovePickupCopy | null;
  /**
   * Why the checkout locks fulfillment to pickup when the cart holds a
   * farm-pickup-only line (GOL-2588). Rides the same brand seam as `pickup` and
   * for the same reason: it names a physical location, so it must never appear on
   * a storefront that has none. `null` wherever `pickup` is null.
   */
  pickupOnlyNote: string | null;
}

/**
 * Per-brand trust-strip copy. Every claim must be true for that brand's
 * products; icons carry no meaning on their own (each pairs with text, and the
 * icon is `aria-hidden` in the render — color-independent by construction).
 *
 * `icon` names a shape that `<TrustIcon>` draws as inline SVG; it is not a
 * character. It held the literal glyphs `✦ ◐ ✓ ♦` until GOL-3117, all of which
 * sit outside the three faces the storefronts load and painted as empty boxes
 * on any client without a symbol font. Only the glyphs changed — every `text`
 * string is byte-identical, because the copy is CMO-Sora / brand-owner
 * territory and this ticket is a rendering fix.
 *
 * Only the nursery sells living plants, so only the nursery carries the
 * "arrive-alive guarantee" (true per /shipping-warranty, GOL-967). GGG ships
 * handmade woodwork; goldberry ships pantry goods (flour, jams, freeze-dried
 * fruit, mushroom kits) — neither "arrives alive," so each gets a claim that
 * holds for what it actually ships.
 *
 * NOTE (brand voice): the nursery copy is board-approved and live. The GGG and
 * goldberry strings are truthful, brand-appropriate defaults for surfaces that
 * are still pre-launch (GGG shop is coming-soon; goldberry not yet open); the
 * exact marketing wording is CMO-Sora / brand-owner territory and should get a
 * voice pass before those storefronts open. The invariant this file guarantees
 * is truthfulness, not final marketing polish.
 */
export const BRAND_TRUST: Record<GroveBrand, BrandTrust> = {
  nursery: {
    cart: [
      { icon: "sparkle", text: "Ships from our farm" },
      { icon: "half-circle", text: "Made by us, on our land" },
      { icon: "check", text: "Arrive-alive guarantee" },
      { icon: "diamond", text: "No payment until we confirm" },
    ],
    checkout: [
      { icon: "sparkle", text: "Card entered on Stripe — never stored by us" },
      { icon: "half-circle", text: "Flat $10 deposit per order on reservations, balance when it ships" },
      { icon: "check", text: "Arrive-alive guarantee" },
    ],
    // Seeds: $1, and the balance is goods plus the actual label cost plus tax,
    // no handling fee (Josh, 2026-10-13). No live-plant promise on seed nuts.
    seedCheckout: [
      { icon: "sparkle", text: "Card entered on Stripe — never stored by us" },
      { icon: "half-circle", text: "Flat $1 deposit per order on seed reservations, the rest plus shipping and tax when it ships" },
      { icon: "check", text: "Ships from our farm" },
    ],
    pickup: {
      shipLabel: "Ship to me — delivered to your address",
      pickupLabel: "Farm pickup — collect at our WV nursery ($0 shipping)",
      pickupNote:
        "Pick up your order at our West Virginia nursery — no shipping charge. West Virginia sales tax applies. We'll email you when it's ready.",
      shipNote:
        "We ship live trees to your address during the planting window for your growing zone.",
    },
    // Names the line so the buyer knows WHICH tree removed the shipping option,
    // and says what to do if they wanted it shipped. No em dash (GOL-589).
    pickupOnlyNote:
      "Your cart has a tree we only release at the farm, so this order is farm pickup. Pick it up at our West Virginia nursery with no shipping charge; West Virginia sales tax applies, and we'll email you when it's ready. Remove that line if you'd rather ship the rest.",
  },
  ggg: {
    cart: [
      { icon: "sparkle", text: "Ships from our workshop" },
      { icon: "half-circle", text: "Made by hand, on our land" },
      { icon: "check", text: "Solid wood, built to last" },
      { icon: "diamond", text: "No payment until we confirm" },
    ],
    checkout: [
      { icon: "sparkle", text: "Card entered on Stripe — never stored by us" },
      { icon: "half-circle", text: "Review your full total before you pay" },
      { icon: "check", text: "Solid wood, built to last" },
    ],
    // No physical pickup point — GGG ships handmade woodwork only.
    pickup: null,
    pickupOnlyNote: null,
  },
  goldberry: {
    // The farm shop sells Printify shirts (GOL-3315): printed to order and
    // shipped by the print partner, so the strip says that and not farm food.
    // No em dash (GOL-589). Approved by Josh 2026-10-13.
    cart: [
      { icon: "sparkle", text: "Printed to order for you" },
      { icon: "half-circle", text: "Ships from our print partner" },
      { icon: "check", text: "Ships to all 50 states and DC" },
      { icon: "diamond", text: "No payment until you review your total" },
    ],
    checkout: [
      { icon: "sparkle", text: "Card entered on Stripe, never stored by us" },
      { icon: "half-circle", text: "Review your full total before you pay" },
      { icon: "check", text: "Printed to order for you" },
    ],
    // No physical pickup point — Printify ships every farm order.
    pickup: null,
    pickupOnlyNote: null,
  },
};

/** The charged-in-full cart badge every brand carries; swapped out on deposit carts. */
const NO_PAYMENT_UNTIL_CONFIRMED = "No payment until we confirm";

/**
 * The cart-page trust strip for what the cart actually charges today.
 *
 * "No payment until we confirm" is true for a charged-in-full cart (Stripe
 * takes the card; we confirm by email before processing) and false for a
 * deposit cart, which charges $1 (seed) or $10 (tree reservation) at checkout.
 * So a deposit cart swaps that badge for "$1 today, the rest when it ships.",
 * with the amount from the confirmed quote's `amount_due_today` (Josh,
 * 2026-10-13). A cart the host already knows is a deposit cart (`depositKind`)
 * drops the badge while the quote is still loading or has failed, so the
 * false claim never flashes; everything else keeps the brand strip verbatim.
 */
export function cartTrustItems(
  brand: GroveBrand,
  opts: { amountDueToday: number | null; depositKind: boolean },
): GroveTrustItem[] {
  const items = BRAND_TRUST[brand].cart;
  if (opts.amountDueToday == null && !opts.depositKind) return items;
  return items.flatMap((item) => {
    if (item.text !== NO_PAYMENT_UNTIL_CONFIRMED) return [item];
    return opts.amountDueToday == null ? [] : [{ icon: item.icon, text: depositTodayLine(opts.amountDueToday) }];
  });
}
