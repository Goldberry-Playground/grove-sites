import { odoo } from "../../../../lib/clients";
import { createPlannerTesterRoute } from "../../../../lib/planner-tester";
import { tenantConfig } from "../../../../tenant.config";

/**
 * POST /api/planner/propose → grove_headless /grove/api/v1/planner/propose
 * (planner-winter-beta spec §C.4, GOL-3551). Tester only: the token comes
 * from the HttpOnly `grove_planner_tester` cookie and is forwarded to Odoo,
 * which names the tester; no cookie is a 403 here, before Odoo is asked.
 */
export const dynamic = "force-dynamic";

export const { POST } = createPlannerTesterRoute(odoo, "propose", { allowedOrigins: tenantConfig.allowedOrigins });
