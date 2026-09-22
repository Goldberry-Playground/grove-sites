import { createCartTiersRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// Volume-discount nudge data (GOL-2432): the automatic tiers from the Odoo
// program (cached like the rate feed) plus this cart's qualifying tree count.
export const { POST } = createCartTiersRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
});
