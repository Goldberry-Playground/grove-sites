import type { MonthDay, ShippingTier } from "@grove/odoo-client";

import { DEPOSIT_CUTOVER, monthDayOf } from "./fulfillment-mode";
import { tierFor } from "./shipping-estimate";

/**
 * Cart-level mirror of the backend flat-deposit rule (GOL-2233,
 * `grove_headless` `_order_takes_deposit`), so the cart page and the checkout
 * form can show "$10 due today" BEFORE the Stripe session exists.
 *
 * The rule, verbatim from the backend:
 *   * sold-out bareroot — any bareroot line short on free (shared-pool) stock,
 *     any fulfillment, any date; OR
 *   * after the season cutover (Oct 15) AND a SHIPPED order carrying at least
 *     one bareroot line (potted-only and farm-pickup charge in full year-round;
 *     an unset fulfillment counts as ship).
 *
 * Either trigger makes the WHOLE cart one flat $10 deposit no matter how many
 * trees are in it; the balance (goods + real shipping + tax) is charged when
 * the trees ship. The backend re-decides this at session time from live free
 * stock, so this is an on-page estimate in exactly the sense the tax line is —
 * the review step and Stripe show the authoritative figure.
 */

/** Flat per-order reservation deposit, in dollars (backend `PREORDER_DEPOSIT`). */
export const RESERVATION_DEPOSIT = 10;

export type CartFulfillment = "ship" | "pickup";

export interface CartDepositLine {
  variantId: number;
  quantity: number;
  /** Effective shipping tier from the catalog API; null/undefined → derive
   *  from `format` (the same fallback the product page uses). */
  shippingTier?: ShippingTier | null;
  /** Format axis value ("Bareroot" / "Potted") for the tier fallback. */
  format?: string | null;
  /** Shared-pool on-hand quantity from the catalog API (`qty_available`).
   *  null/undefined when the payload omits it — then `available` decides. */
  qtyAvailable?: number | null;
  /** Catalog `available` flag, the fallback when no quantity is known. */
  available?: boolean;
}

export type CartDepositReason = "sold-out" | "off-season" | null;

export interface CartDepositLineQuote {
  variantId: number;
  bareroot: boolean;
  soldOut: boolean;
}

export interface CartDepositQuote {
  /** True when the cart charges the flat deposit today instead of in full. */
  depositNow: boolean;
  depositReason: CartDepositReason;
  /** Dollars charged today under the deposit path; null when charged in full. */
  amountDueToday: number | null;
  lines: CartDepositLineQuote[];
}

export interface ResolveCartDepositOpts {
  /** Decision date; defaults to now. Compared in UTC like the backend. */
  today?: Date;
  /** Buyer's fulfillment choice; unset counts as ship (backend idiom). */
  fulfillment?: CartFulfillment | null;
  /** Season cutover override (tests); defaults to {@link DEPOSIT_CUTOVER}. */
  depositCutover?: MonthDay;
}

function ord(md: MonthDay): number {
  return md[0] * 100 + md[1];
}

/** Stock the line can draw on. Unknown quantity falls back to the boolean
 *  `available` flag: in stock → unbounded, out of stock → zero. */
function sellableQty(line: CartDepositLine): number {
  if (line.qtyAvailable != null) return line.qtyAvailable;
  return line.available === false ? 0 : Number.POSITIVE_INFINITY;
}

export function resolveCartDeposit(
  lines: readonly CartDepositLine[],
  opts: ResolveCartDepositOpts = {},
): CartDepositQuote {
  const quotedLines: CartDepositLineQuote[] = lines.map((line) => {
    const bareroot =
      tierFor({ shippingTier: line.shippingTier ?? null, format: line.format ?? null }) ===
      "bareroot";
    // Potted never triggers the sold-out deposit — it is not reservable.
    const soldOut = bareroot && sellableQty(line) < line.quantity;
    return { variantId: line.variantId, bareroot, soldOut };
  });

  let depositReason: CartDepositReason = null;
  if (quotedLines.some((l) => l.soldOut)) {
    depositReason = "sold-out";
  } else {
    const today = opts.today ?? new Date();
    const afterCutover = ord(monthDayOf(today)) > ord(opts.depositCutover ?? DEPOSIT_CUTOVER);
    const shipped = opts.fulfillment !== "pickup";
    if (afterCutover && shipped && quotedLines.some((l) => l.bareroot)) {
      depositReason = "off-season";
    }
  }

  const depositNow = depositReason !== null;
  return {
    depositNow,
    depositReason,
    amountDueToday: depositNow ? RESERVATION_DEPOSIT : null,
    lines: quotedLines,
  };
}
