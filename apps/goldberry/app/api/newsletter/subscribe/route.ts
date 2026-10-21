import { createNewsletterSubscribeRoute } from "@grove/newsletter";
import { tenantConfig } from "../../../../tenant.config";

/**
 * Newsletter opt-in capture → Odoo Email Marketing, the list of record
 * (GOL-3454 / GOL-3456, Josh "option C"). The brand is pinned here, server-side:
 * a form on this site subscribes to Farm News as its primary, and only the
 * explicit "other Grove brands" box adds the rest. Single opt-in; Odoo sends
 * the welcome email. 503 until ODOO_URL / ODOO_API_KEY are provisioned.
 */
export const dynamic = "force-dynamic";

export const { POST } = createNewsletterSubscribeRoute({
  brand: "goldberry",
  tenantId: tenantConfig.tenantId,
  allowedOrigins: tenantConfig.allowedOrigins,
});
