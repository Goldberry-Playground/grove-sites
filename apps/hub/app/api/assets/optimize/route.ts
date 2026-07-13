/**
 * POST /api/assets/optimize (GOL-290)
 *
 * Bearer-authed optimize+upload endpoint the AgenticOS `#assets` ingest job calls
 * (GOL-92). Multipart body: `meta` (JSON `{brand, assetClass, slug, filename}`)
 * plus `file` (raw image bytes). Returns `{ cdnUrl, key }`.
 *
 * Runs on the Node runtime because `@grove/assets` uses native `sharp`.
 */
import { checkAuth, handleOptimize, optimizeDepsFromEnv, withConfig } from "../../../../lib/assets/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = checkAuth(req);
  if (unauthorized) return unauthorized;
  return withConfig(() => optimizeDepsFromEnv(), (deps) => handleOptimize(req, deps));
}
