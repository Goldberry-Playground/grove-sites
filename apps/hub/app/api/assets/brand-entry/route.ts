/**
 * POST /api/assets/brand-entry (GOL-290)
 *
 * Bearer-authed logo lane (ADR-009 Tier 4). Same multipart body as /optimize,
 * plus `caption` in `meta`. Optimizes the logo (unless the caller already passed
 * `cdnUrl`+`key`), then opens the typed `@grove/brand` registry PR. Returns
 * `{ prUrl, cdnUrl, key }`.
 *
 * Runs on the Node runtime because `@grove/assets` uses native `sharp`.
 */
import {
  brandEntryDepsFromEnv,
  checkAuth,
  handleBrandEntry,
  withConfig,
} from "../../../../lib/assets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = checkAuth(req);
  if (unauthorized) return unauthorized;
  return withConfig(() => brandEntryDepsFromEnv(), (deps) => handleBrandEntry(req, deps));
}
