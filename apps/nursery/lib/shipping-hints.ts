import type { ShippingTier } from "@grove/odoo-client";

/**
 * Static landed-cost transparency hints (design spec §4 "Shipping-cost lever —
 * radical transparency v1"). The product page shows a potted-vs-bareroot delta
 * so buyers self-select the cheaper-to-ship format:
 *
 *   Potted   — heavy box (~25 lb), ships now,        from ~$28
 *   Bareroot — slim box  (~4 lb),  reserve for fall,  from ~$12
 *
 * These are intentionally *static* "from $X" hints, not a live rate quote —
 * the real per-zone rate is computed at checkout. Numbers come from the
 * grove_shipping_tier fix in grove_headless (bareroot ships at the bareroot
 * tier, not the potted template tier). Revisit once real order data lands
 * (the "consolidation nudges" follow-up).
 */
export interface ShippingHint {
  /** Lowest observed landed shipping cost for this tier, in whole dollars. */
  fromShipping: number;
  /** Fulfillment timing line shown next to the format. */
  fulfillment: string;
  /** True for preorder formats (bareroot) — drives the $10-deposit copy. */
  preorder: boolean;
}

const HINTS: Record<ShippingTier, ShippingHint> = {
  potted: { fromShipping: 28, fulfillment: "Ships now", preorder: false },
  bareroot: {
    fromShipping: 12,
    fulfillment: "Reserve for October",
    preorder: true,
  },
};

/**
 * Resolve the shipping hint for a variant. Prefers the server-computed
 * `shippingTier`; falls back to sniffing the Format axis string ("Bareroot")
 * so a partial/older payload still shows a sensible hint. Returns the potted
 * hint as the safe default (heavier, more expensive — never under-quotes).
 */
export function shippingHintFor(input: {
  shippingTier?: ShippingTier | null;
  format?: string | null;
}): ShippingHint {
  if (input.shippingTier && HINTS[input.shippingTier]) {
    return HINTS[input.shippingTier];
  }
  if (input.format && /bare\s*-?\s*root/i.test(input.format)) {
    return HINTS.bareroot;
  }
  return HINTS.potted;
}
