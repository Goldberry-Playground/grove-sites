import { createCheckoutSuccessPage } from "@grove/checkout/server";
import { odoo } from "../../../lib/clients";
import { tenantConfig } from "../../../tenant.config";

// Stripe post-payment confirmation. Order id + access token arrive in the
// `grove_checkout_handoff` cookie (set pre-redirect), keeping the token out of
// the URL. `referrer: "no-referrer"` is belt-and-suspenders on the session_id.
export const metadata = {
  title: `Payment Received — ${tenantConfig.name}`,
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default createCheckoutSuccessPage({ odoo });
