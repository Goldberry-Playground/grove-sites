import type { Vendor } from "../data/marketplace";
import { buildCheckoutUrl } from "../data/marketplace";

type Props = {
  vendor: Vendor;
  productId: number;
};

/**
 * Renders a form that POSTs the user directly into the vendor's Odoo cart.
 *
 * The hub never sees the response — submit takes the browser away. This is
 * the structural reason the hub is not PCI-scope.
 *
 * Server component — no JS shipped to the browser for the hand-off itself.
 * The browser's native form-submit semantics carry the user away.
 */
export function BuyAtVendorForm({ vendor, productId }: Props) {
  const action = buildCheckoutUrl(vendor, productId);

  return (
    <form
      action={action}
      method="post"
      style={{ display: "inline" }}
    >
      <input
        type="hidden"
        name="product_id"
        value={productId}
        data-testid="hidden-product-id"
      />
      <input
        type="hidden"
        name="add_qty"
        value="1"
        data-testid="hidden-add-qty"
      />
      <input
        type="hidden"
        name="referrer"
        value="grove-hub"
        data-testid="hidden-referrer"
      />
      <button
        type="submit"
        className="btn-buy"
        style={{ backgroundColor: vendor.brandColor }}
      >
        Buy from {vendor.name} →
      </button>
    </form>
  );
}
