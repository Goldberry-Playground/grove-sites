import { test, type Page } from "@playwright/test";

/**
 * Shared skip guards for the planner acceptance specs (GOL-3383 / GOL-3550).
 *
 * The planner specs assert a *built* plan — the "Twenty trees" heading, planned
 * lines, a cart. That only renders when the target's planner catalog feed
 * carries plants. Two independent conditions leave the feed without any, and in
 * both the storefront is behaving correctly; failing the gate would be a false
 * red:
 *
 *   1. `PLANNER_ENABLED` is unset (prod today, GOL-3527) → `/plan` is a 404.
 *   2. The target's Odoo has no planner-ready plants. An ephemeral QA that
 *      bring-up does not seed with planner facts returns a present-but-empty
 *      feed (`plants: []`, `catalog_version: 0`), so the quiz renders its empty
 *      state ("Nothing we grow fits open ground…") instead of a plan (GOL-3997).
 *      The BFF's fixture fallback does not cover this — it only fires when Odoo
 *      has *no* feed at all, not when the feed is present but empty.
 *
 * Call both from `beforeEach`, in order: the 404 guard navigates to `/plan`, and
 * the feed guard then checks the catalog the quiz would run over.
 */

/** Skip when `PLANNER_ENABLED` is off on this target (`/plan` → 404). */
export async function skipIfPlannerDisabled(page: Page): Promise<void> {
  const res = await page.goto("/plan");
  test.skip(res?.status() === 404, "PLANNER_ENABLED is off on this target");
}

/**
 * Skip when the planner catalog feed carries no plants, so no plan can be built.
 * Covers both a 503 `catalog_unavailable` (no feed) and a present-but-empty feed
 * (`plants: []`) — the QA data gap tracked in GOL-3997. Coverage returns on its
 * own once the target's feed carries planner-ready plants.
 */
export async function skipIfPlannerFeedEmpty(page: Page): Promise<void> {
  let plants: unknown = [];
  const res = await page.request.get("/api/planner/catalog");
  if (res.ok()) {
    plants = ((await res.json()) as { plants?: unknown }).plants ?? [];
  }
  test.skip(
    !Array.isArray(plants) || plants.length === 0,
    "planner catalog feed has no plants on this target (GOL-3997: QA Odoo not seeded with planner data)",
  );
}
