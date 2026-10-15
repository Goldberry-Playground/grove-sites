import { createLeadCaptureRoute } from "@grove/checkout/server";
import { odoo } from "../../../lib/clients";
import { tenantConfig } from "../../../tenant.config";

// Farm visit requests (private events, seminars, u-pick) -> Odoo CRM leads
// (2026-10-15 hotfix: customer relationships live in Odoo, not Ghost).
export const { POST } = createLeadCaptureRoute(odoo, { allowedOrigins: tenantConfig.allowedOrigins });
