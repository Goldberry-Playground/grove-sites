import { NextResponse } from "next/server";
import { odoo } from "../../../../lib/clients";
import { loadPlannerCatalog } from "../../../../lib/planner-catalog";

/**
 * Planner catalog BFF (order-builder spec §B / §C, GOL-3383).
 *
 * GET /api/planner/catalog → the grove_headless planner feed with every plant
 * and bundle resolved to its cart variant id, plus the ship calendar. The
 * browser fetches this once per quiz run and never talks to Odoo directly.
 *
 * 503 `{ error: "catalog_unavailable" }` when Odoo has no feed in production;
 * outside production (or with PLANNER_FIXTURE_FALLBACK=1) the fixture catalog
 * is served instead, the same way /shop falls back to its mock product list,
 * so the quiz renders on a preview without a backend.
 */
export const dynamic = "force-dynamic";

const ALLOW_FIXTURE =
  process.env.NODE_ENV !== "production" || process.env.PLANNER_FIXTURE_FALLBACK === "1";

export async function GET() {
  const payload = await loadPlannerCatalog(odoo, { allowFixture: ALLOW_FIXTURE });
  if (!payload) {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
