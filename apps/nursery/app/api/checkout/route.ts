import { createCheckoutRoute } from "@grove/checkout/server";
import { odoo } from "../../../lib/clients";
import { tenantConfig } from "../../../tenant.config";

export const POST = createCheckoutRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
});
