import { createPublishWebhookRoute } from "@grove/checkout/server";
import { tenantSecrets } from "../../../../tenant.secrets";
import { tenantConfig } from "../../../../tenant.config";

// Odoo "guide.publish" webhook receiver (GOL-986 / GOL-1000). Verifies the
// per-tenant HMAC signature and revalidates the affected product page(s).
// Contract: grove-odoo-modules grove_headless/docs/publish-webhook-contract.md.
export const dynamic = "force-dynamic";

export const POST = createPublishWebhookRoute({
  secret: tenantSecrets.grovePublishWebhookSecret,
  tenant: tenantConfig.tenantId,
});
