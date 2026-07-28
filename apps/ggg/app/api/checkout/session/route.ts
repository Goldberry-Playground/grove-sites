import { createCheckoutSessionRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// Stripe Checkout session. Same validated order payload as /api/checkout plus
// successUrl/cancelUrl; returns a CheckoutSession whose `checkoutUrl` the client
// redirects the browser to. The Stripe secret key never reaches the browser.
export const POST = createCheckoutSessionRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
});
