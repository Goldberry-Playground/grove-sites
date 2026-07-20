import { createCheckoutSessionRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

export const POST = createCheckoutSessionRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
});
