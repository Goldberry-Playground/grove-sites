import { odoo } from "../../../../lib/clients";
import { createPlannerLearningRoute } from "../../../../lib/planner-learning";
import { tenantConfig } from "../../../../tenant.config";

/**
 * POST /api/planner/save → grove_headless /grove/api/v1/planner/save
 * (planner-winter-beta spec §C, GOL-3550). Origin gate, honeypot and a
 * per-client limit live in the shared handler; Odoo's kill switch surfaces
 * as 503, which the page treats as a silent no-op.
 */
export const dynamic = "force-dynamic";

export const { POST } = createPlannerLearningRoute(odoo, "save", { allowedOrigins: tenantConfig.allowedOrigins });
