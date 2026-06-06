import { createGhostClient } from "@grove/ghost-client";

/**
 * Server-side Ghost client for the GGG tenant.
 *
 * Separated from `clients.ts` so pages that only need Ghost (e.g. /blog)
 * don't trigger the Odoo client's env-var validation at import time.
 * Once ODOO_API_KEY is consistently present in all environments, this
 * can be folded back into the shared clients module.
 */
export const ghost = createGhostClient({
  ghostUrl: process.env.GHOST_URL || "http://localhost:2369",
  contentKey: process.env.GHOST_CONTENT_KEY || "",
});
