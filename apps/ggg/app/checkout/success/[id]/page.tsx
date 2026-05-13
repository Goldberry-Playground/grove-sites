import { createOrderSuccessPage } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// `referrer: "no-referrer"` prevents the access_token query param from leaking to third parties via the Referer header.
export const metadata = { title: `Order Confirmed — ${tenantConfig.name}`, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default createOrderSuccessPage({ odoo });
