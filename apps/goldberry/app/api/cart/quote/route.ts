import { createCartQuoteRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

// Pre-checkout quote for the farm's Printify shirts (GOL-3315, gom printify
// spec §5). The backend quotes Printify's live shipping once the request
// carries state and ZIP; a Printify outage (503) or a mixed shirt-and-tree
// cart (409) is relayed to the browser with the backend's own words, never
// replaced by a catalog estimate. The farm has no deposit rule, so the
// catalog fallback (backend unreachable) simply says "no deposit"; the
// checkout page then shows shipping as unavailable and keeps submit blocked.
// Read-only: no order is created here.
export const { POST } = createCartQuoteRoute(odoo, {
  allowedOrigins: tenantConfig.allowedOrigins,
  resolve: () => ({ depositNow: false, depositReason: null, amountDueToday: null }),
  relayStatuses: [400, 409, 503],
});
