import type { ShippingTier } from "@grove/odoo-client";
import { shippingHintFor } from "./shipping-hints";

/**
 * Single source of truth for the product buy box's purchasable state (GOL-678).
 *
 * The bug this fixes: a Bareroot (preorder) format renders a red "Sold out"
 * line plus "reserve now with a $10 deposit" copy while the Add-to-Cart button
 * is dead — the shopper is told to reserve but cannot. Bareroot is *sold by
 * preorder*, so an empty on-hand count means "reserve for fall", not "gone".
 *
 * Three modes, derived once here and consumed by BOTH the inline buy box and
 * the mobile sticky bar so the two can never contradict each other:
 *
 *   in-stock   — on hand now                → "Add to Cart", enabled
 *   reservable — 0 on hand but preorderable → "Reserve",     enabled + deposit note
 *   sold-out   — 0 on hand, not preorderable→ "Sold out",    disabled
 *
 * Every mode's `stockLabel` carries the meaning in *words*, not colour alone,
 * so the state survives grayscale / colour-blind reading (accessibility lens:
 * colour-independence).
 */
export type BuyMode = "in-stock" | "reservable" | "sold-out";

export type StockTone = "in-stock" | "reserve" | "sold-out";

export interface BuyStateInput {
  /** Selected variant on-hand availability (Odoo `available`). */
  available: boolean;
  /** Exact on-hand count when known. */
  qtyAvailable: number | null;
  /** Server-computed shipping tier, if resolved. */
  shippingTier: ShippingTier | null;
  /** Selected Format axis value ("Bareroot" / "Potted"), for hint fallback. */
  format: string | null;
}

export interface BuyState {
  mode: BuyMode;
  /** Add-to-Cart / sticky-bar disabled flag. */
  ctaDisabled: boolean;
  /** Idle CTA label: "Add to Cart" | "Reserve". */
  ctaLabel: string;
  /** Stock line text — self-describing, never colour-dependent. */
  stockLabel: string;
  /** Tone token for stock-line colour (paired with the words above). */
  stockTone: StockTone;
  /** Show the "$10 deposit applied to your total" preorder note. */
  showDepositNote: boolean;
}

/**
 * Resolve the buy state for the currently selected variant. `undefined`/absent
 * selection (a product with no variants) is treated as purchasable at the
 * product level — the caller supplies `available: true` in that case.
 */
export function buyStateFor(input: BuyStateInput): BuyState {
  const hint = shippingHintFor({
    shippingTier: input.shippingTier,
    format: input.format,
  });

  if (input.available) {
    const stockLabel =
      input.qtyAvailable != null && input.qtyAvailable > 0
        ? `${input.qtyAvailable} in stock`
        : "In stock";
    return {
      mode: "in-stock",
      ctaDisabled: false,
      ctaLabel: "Add to Cart",
      stockLabel,
      stockTone: "in-stock",
      showDepositNote: false,
    };
  }

  // Out of on-hand stock. A preorder format (Bareroot) is still purchasable as
  // a reservation, so keep the CTA live and relabel it.
  if (hint.preorder) {
    return {
      mode: "reservable",
      ctaDisabled: false,
      ctaLabel: "Reserve",
      // Qualify the "sold out" so it can't read as "unpurchasable" (GOL-678).
      // No em dash — Grove voice rule (GOL-589).
      stockLabel: `Sold out for immediate shipping. ${hint.fulfillment}.`,
      stockTone: "reserve",
      showDepositNote: true,
    };
  }

  // Truly unavailable — no stock and not a preorder format.
  return {
    mode: "sold-out",
    ctaDisabled: true,
    ctaLabel: "Sold out",
    stockLabel: "Sold out",
    stockTone: "sold-out",
    showDepositNote: false,
  };
}
