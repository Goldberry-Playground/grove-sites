import { createOdooClient } from "@grove/odoo-client";
import { createGhostClient } from "@grove/ghost-client";
import { tenantConfig } from "../tenant.config";
import { tenantSecrets } from "../tenant.secrets";

/** Server-side Odoo client for the GGG tenant. */
export const odoo = createOdooClient({
  tenantId: tenantConfig.tenantId,
  odooUrl: tenantSecrets.odooUrl,
  apiKey: tenantSecrets.odooApiKey || undefined,
});

/** Server-side Ghost client for the GGG tenant. */
export const ghost = createGhostClient({
  ghostUrl: tenantSecrets.ghostUrl,
  contentKey: tenantSecrets.ghostContentKey,
});
