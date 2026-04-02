import { createOdooClient } from "@grove/odoo-client";
import { createGhostClient } from "@grove/ghost-client";
import { tenantConfig } from "../tenant.config";

/** Server-side Odoo client for the Goldberry tenant. */
export const odoo = createOdooClient({
  tenantId: tenantConfig.tenantId,
  odooUrl: tenantConfig.odooUrl,
  apiKey: tenantConfig.odooApiKey || undefined,
});

/** Server-side Ghost client for the Goldberry tenant. */
export const ghost = createGhostClient({
  ghostUrl: tenantConfig.ghostUrl,
  contentKey: tenantConfig.ghostContentKey,
});
