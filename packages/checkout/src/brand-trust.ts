import type { GroveTrustItem, GrovePickupCopy } from "@grove/ui-kit";

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
   * Farm-pickup fulfillment. `null` for brands with no pickup location — the
   * checkout renders ship-only and never shows a pickup option. Only the
   * nursery has a physical West Virginia pickup point, and its copy names live
   * trees + a WV tax jurisdiction, so this must ride the brand seam rather than
   * default on in the shared kit (GOL-1075 shipped pickup; GOL-1314 stopped it
   * leaking onto ggg/goldberry). The copy is the single source of truth for the
   * ship-vs-pickup fieldset wording.
   */
  pickup: GrovePickupCopy | null;
}

/**
 * Per-brand trust-strip copy. Every claim must be true for that brand's
 * products; icons carry no meaning on their own (each pairs with text, and the
 * icon is `aria-hidden` in the render — color-independent by construction).
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
      { icon: "✦", text: "Ships from our farm" },
      { icon: "◐", text: "Made by us, on our land" },
      { icon: "✓", text: "Arrive-alive guarantee" },
      { icon: "♦", text: "No payment until we confirm" },
    ],
    checkout: [
      { icon: "✦", text: "Card entered on Stripe — never stored by us" },
      { icon: "◐", text: "$10 deposit per tree on preorders, balance when it ships" },
      { icon: "✓", text: "Arrive-alive guarantee" },
    ],
    pickup: {
      shipLabel: "Ship to me — delivered to your address",
      pickupLabel: "Farm pickup — collect at our WV nursery ($0 shipping)",
      pickupNote:
        "Pick up your order at our West Virginia nursery — no shipping charge. West Virginia sales tax applies. We'll email you when it's ready.",
      shipNote:
        "We ship live trees to your address during the planting window for your growing zone.",
    },
  },
  ggg: {
    cart: [
      { icon: "✦", text: "Ships from our workshop" },
      { icon: "◐", text: "Made by hand, on our land" },
      { icon: "✓", text: "Solid wood, built to last" },
      { icon: "♦", text: "No payment until we confirm" },
    ],
    checkout: [
      { icon: "✦", text: "Card entered on Stripe — never stored by us" },
      { icon: "◐", text: "Review your full total before you pay" },
      { icon: "✓", text: "Solid wood, built to last" },
    ],
    // No physical pickup point — GGG ships handmade woodwork only.
    pickup: null,
  },
  goldberry: {
    cart: [
      { icon: "✦", text: "Ships from our farm" },
      { icon: "◐", text: "Grown and made on our land" },
      { icon: "✓", text: "Packed fresh, sealed for the trip" },
      { icon: "♦", text: "No payment until we confirm" },
    ],
    checkout: [
      { icon: "✦", text: "Card entered on Stripe — never stored by us" },
      { icon: "◐", text: "Review your full total before you pay" },
      { icon: "✓", text: "Packed fresh, sealed for the trip" },
    ],
    // No physical pickup point — goldberry ships pantry goods only.
    pickup: null,
  },
};
