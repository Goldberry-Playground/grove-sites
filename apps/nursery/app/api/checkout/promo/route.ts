import { createPromoPreviewRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// Promo-code Apply preview (GOL-2432). Asks the backend what the order would be
// discounted — the typed code or the automatic volume tier, whichever is worth
// more — without creating an order or a Stripe session.
export const { POST } = createPromoPreviewRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
});
