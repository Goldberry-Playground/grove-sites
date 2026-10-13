import { createCheckoutSuccessPage } from "@grove/checkout/server";
import { odoo } from "../../../lib/clients";
import { tenantConfig } from "../../../tenant.config";

// Stripe post-payment confirmation. Order id + access token arrive in the
// `grove_checkout_handoff` cookie (set pre-redirect), keeping the token out of
// the URL. `referrer: "no-referrer"` is belt-and-suspenders on the session_id.
export const metadata = {
  title: `Payment received | ${tenantConfig.name}`,
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

// Printed-to-order note (GOL-3315, gom printify spec Storefront §5). The lead
// time here is the Printify default; the PDP shows each shirt's own.
export default createCheckoutSuccessPage({
  odoo,
  fulfillmentNote:
    "Your shirt is printed to order and usually ships in 3 to 7 business days. We'll email tracking when it's on the way.",
});
