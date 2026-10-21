import { createNewsletterSubscribeRoute } from "@grove/newsletter";
import { tenantConfig } from "../../../../tenant.config";

/**
 * Newsletter opt-in capture → Odoo Email Marketing, the list of record
 * (GOL-3454 / GOL-3456, Josh "option C"). The hub's primary list is the Grove
 * Digest; the explicit "other Grove brands" box adds Nursery News + Farm News.
 * `hub` is not an Odoo website, so the tenant header falls through to Host
 * routing and grove_headless defaults the list to the Digest. Single opt-in;
 * Odoo sends the welcome email. 503 until GROVE_ODOO_URL + ODOO_API_KEY are
 * provisioned for this app.
 */
export const dynamic = "force-dynamic";

export const { POST } = createNewsletterSubscribeRoute({
  brand: "grove",
  tenantId: tenantConfig.tenantId,
  allowedOrigins: tenantConfig.allowedOrigins,
});
