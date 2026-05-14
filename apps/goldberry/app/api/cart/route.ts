import { createCartRoute } from "@grove/checkout/server";
import { odoo } from "../../../lib/clients";
import { tenantConfig } from "../../../tenant.config";

const { GET: cartGet, POST: cartPost } = createCartRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
});
export { cartGet as GET, cartPost as POST };
