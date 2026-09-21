import { createCartQuoteRoute } from "@grove/checkout/server";
import { resolveCartDeposit } from "../../../../lib/cart-deposit";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// Pre-checkout charge preview (GOL-2233). The kit route enriches each cart
// line with live catalog stock + tier; the nursery's `resolveCartDeposit`
// mirrors the backend flat-deposit rule so the cart and checkout summaries can
// show "$10 due today" for a reservation before the Stripe session exists.
// Read-only: no order is created here.
export const { POST } = createCartQuoteRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
  resolve: (lines, { fulfillment }) => resolveCartDeposit(lines, { fulfillment }),
});
