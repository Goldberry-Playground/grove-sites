import { createOrderSuccessPage } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// `referrer: "no-referrer"` prevents the access_token query param from leaking to third parties via the Referer header.
// Title is the LEFT side only — `app/layout.tsx` appends " | At The Grove
// Nursery" via `title.template` (GOL-2878). Repeating the brand here renders it
// twice.
export const metadata = { title: "Order Confirmed", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default createOrderSuccessPage({ odoo });
