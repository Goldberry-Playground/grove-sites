import { createRestockCaptureRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// Back-in-stock alerts -> Odoo stock notifications; Odoo emails the shopper
// automatically when the product is restocked (2026-10-15 hotfix).
export const { POST } = createRestockCaptureRoute(odoo, { allowedOrigins: tenantConfig.allowedOrigins });
