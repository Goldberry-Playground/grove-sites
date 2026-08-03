/**
 * POST /api/assets/social (GOL-1122, parent GOL-1119)
 *
 * Bearer-authed social-media re-host endpoint the discord-bridge front door
 * calls (`apps/discord-bridge/lib/rehost-client.ts`). Multipart body: `meta`
 * (JSON `{declaredType, source, filename?, igPostType?, altText?, keyPrefix?}`)
 * plus `file` (raw operator-dropped image/video bytes). Strips EXIF/GPS,
 * re-hosts to grove-assets Spaces, and returns the validated `MediaAsset` JSON
 * (durable public https `url`) that plugs into a `content_suggestion.media`.
 *
 * Reuses the same bearer token as `POST /api/assets/optimize`
 * (`GROVE_ASSETS_OPTIMIZE_TOKEN`) — a sibling under the same trust boundary
 * (see GOL-1123). Runs on the Node runtime because the re-host uses native `sharp`.
 */
import { checkAuth, withConfig } from "../../../../lib/assets/service";
import { handleSocialRehost, rehostDepsFromEnv } from "../../../../lib/assets/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = checkAuth(req);
  if (unauthorized) return unauthorized;
  return withConfig(() => rehostDepsFromEnv(), (deps) => handleSocialRehost(req, deps));
}
