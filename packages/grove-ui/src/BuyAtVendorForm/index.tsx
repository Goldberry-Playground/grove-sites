"use client";

import type { CSSProperties, FormEvent } from "react";

export interface BuyAtVendorFormProps {
  /** Product id POSTed into the vendor cart (hidden field). */
  productId: number;
  /** Vendor display name, used in the button label. */
  vendorName: string;
  /**
   * Form submit endpoint. The browser's native form-submit carries the user
   * to the vendor's cart — supplied by the caller, never hardcoded here.
   */
  action?: string;
  /**
   * Optional submit handler. When provided it runs alongside (or in place of)
   * the native POST — callers may `preventDefault` to take over the hand-off.
   */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Per-vendor accent for the button background (inline style, not a token). */
  accentColor?: string;
  /** Referrer tag POSTed with the cart hand-off. */
  referrer?: string;
}

/**
 * Renders a form that POSTs the user directly into a vendor's cart. Fully
 * presentational: the submit `action` is a prop, so no app route is baked in.
 * Styled against `--grove-*`; the button accent is a prop.
 */
export function BuyAtVendorForm({
  productId,
  vendorName,
  action,
  onSubmit,
  accentColor,
  referrer = "grove-hub",
}: BuyAtVendorFormProps) {
  const buttonStyle: CSSProperties | undefined = accentColor
    ? { backgroundColor: accentColor, borderColor: accentColor }
    : undefined;

  return (
    <form action={action} method="post" onSubmit={onSubmit} style={{ display: "inline" }}>
      <input
        type="hidden"
        name="product_id"
        value={productId}
        data-testid="hidden-product-id"
      />
      <input type="hidden" name="add_qty" value="1" data-testid="hidden-add-qty" />
      <input
        type="hidden"
        name="referrer"
        value={referrer}
        data-testid="hidden-referrer"
      />
      <button type="submit" className="btn-buy" style={buttonStyle}>
        Buy from {vendorName} →
      </button>
    </form>
  );
}
