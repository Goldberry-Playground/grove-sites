/**
 * Server-side social-media re-host service (GOL-1122, parent GOL-1119) — the
 * HTTP body behind the hub's `POST /api/assets/social` route handler.
 *
 * Why this lives in the hub and not the discord-bridge: the bridge is
 * zero-runtime-dependency by design (its Dockerfile copies only
 * `apps/discord-bridge` and runs `node server.ts` with no install), so native
 * `sharp` — which the privacy-critical EXIF/GPS strip needs — cannot run there.
 * The re-host therefore runs here (same trust boundary and credentials as the
 * already-live `POST /api/assets/optimize`), and the bridge forwards the raw
 * operator drop over one HTTP call (see `apps/discord-bridge/lib/rehost-client.ts`).
 *
 * The re-host ORCHESTRATION is not re-implemented here: we run the exact same
 * pure seam the bridge owns (`rehostToMediaAsset`, `apps/discord-bridge/lib`),
 * injecting the two concrete backends it asks for — a sharp EXIF-strip
 * normalizer and a Spaces `put`. The seam stays the single tested source of
 * truth for the allowlist / size caps / content-hash idempotency / MediaAsset
 * validation; this file only supplies sharp + Spaces. Importing the seam's PURE
 * modules across the app boundary is safe (they pull only `node:crypto`); the
 * native `sharp`/AWS SDK deps are loaded lazily in the env-backed deps builder
 * so the route module stays sharp-free at `next build` time (same reason
 * `service.ts` type-imports `@grove/assets`).
 */
import { NextResponse } from "next/server";
import {
  IngestError,
  rehostToMediaAsset,
  type AssetStore,
  type IngestDeps,
  type MediaNormalizer,
  type NormalizedMedia,
  type RawUpload,
} from "../../../discord-bridge/lib/ingest";
import type { IgPostType, MediaSource, MediaType } from "../../../discord-bridge/lib/media";
// Type-only: @grove/assets pulls in native sharp; keep it out of the build-time
// module graph. Concrete values are dynamically imported in rehostDepsFromEnv.
import type { SpacesAssetConfig } from "@grove/assets";

/** Env var holding the shared bearer token (reused from the optimize endpoint). */
const MEDIA_TYPES: readonly MediaType[] = ["image", "video"];
const MEDIA_SOURCES: readonly MediaSource[] = ["canva", "manual"];

/** Largest edge we re-encode a social image to. Buffer/IG downscale anything larger. */
const SOCIAL_MAX_EDGE = 1600;
const SOCIAL_WEBP_QUALITY = 82;

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface ParsedRehostForm {
  meta: Record<string, unknown>;
  bytes: Uint8Array;
  filename: string | null;
}

/** Parse the `meta` (JSON) + required `file` multipart body the bridge sends. */
async function parseForm(req: Request): Promise<ParsedRehostForm | { error: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: "invalid_multipart" };
  }
  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") return { error: "missing_meta" };
  let meta: unknown;
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return { error: "invalid_meta_json" };
  }
  if (!meta || typeof meta !== "object") return { error: "invalid_meta" };
  const file = form.get("file");
  if (!file || typeof file === "string") return { error: "missing_file" };
  const blob = file as Blob & { name?: string };
  return {
    meta: meta as Record<string, unknown>,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    filename: typeof blob.name === "string" ? blob.name : null,
  };
}

function str(meta: Record<string, unknown>, field: string): string {
  const v = meta[field];
  return typeof v === "string" ? v.trim() : "";
}

/** Build a validated {@link RawUpload} from the multipart meta, or an error tag. */
function buildRawUpload(
  meta: Record<string, unknown>,
  bytes: Uint8Array,
  fallbackFilename: string | null,
): RawUpload | { error: string; field?: string } {
  const declaredType = str(meta, "declaredType");
  const source = str(meta, "source");
  const filename = str(meta, "filename") || fallbackFilename || "";
  if (!MEDIA_TYPES.includes(declaredType as MediaType)) {
    return { error: "invalid_field", field: "declaredType" };
  }
  if (!MEDIA_SOURCES.includes(source as MediaSource)) {
    return { error: "invalid_field", field: "source" };
  }
  if (!filename) return { error: "missing_field", field: "filename" };
  return {
    bytes,
    filename,
    declaredType: declaredType as MediaType,
    source: source as MediaSource,
  };
}

export interface RehostDeps extends IngestDeps {}

/**
 * POST /api/assets/social — multipart `meta` + `file` → the validated
 * {@link import("../../../discord-bridge/lib/media.ts").MediaAsset} JSON that
 * plugs straight into a `content_suggestion.media`.
 *
 * Content/validation failures from the seam ({@link IngestError} or the media
 * contract) are 422 (unprocessable drop); a store/backend failure is 502. Both
 * fail loud here at ingest time, never silently at Buffer publish time.
 */
export async function handleSocialRehost(req: Request, deps: RehostDeps): Promise<NextResponse> {
  const parsed = await parseForm(req);
  if ("error" in parsed) return json(parsed, 400);

  const raw = buildRawUpload(parsed.meta, parsed.bytes, parsed.filename);
  if ("error" in raw) return json(raw, 400);

  const igPostType = str(parsed.meta, "igPostType") || undefined;
  const altText = str(parsed.meta, "altText") || undefined;
  const keyPrefix = str(parsed.meta, "keyPrefix") || undefined;

  try {
    const asset = await rehostToMediaAsset(raw, deps, {
      igPostType: igPostType as IgPostType | undefined,
      altText,
      keyPrefix,
    });
    return json(asset, 200);
  } catch (err) {
    // IngestError (seam) and MediaContractError (media contract) are both caller
    // /content errors — the dropped file violated an allowlist / size / URL rule.
    if (err instanceof IngestError || (err as { name?: string })?.name === "MediaContractError") {
      return json({ error: "rehost_rejected", detail: message(err) }, 422);
    }
    return json({ error: "rehost_failed", detail: message(err) }, 502);
  }
}

/* ---------------------------- env-backed deps ---------------------------- */

/**
 * Real re-host dependencies: a sharp-backed EXIF/GPS-strip normalizer and a
 * Spaces `put`. `@grove/assets` (native `sharp` + AWS SDK) and the S3 client are
 * imported lazily so the route module stays sharp-free at build time.
 */
export async function rehostDepsFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<RehostDeps> {
  const [{ cdnUrlFor, spacesConfigFromEnv, CACHE_CONTROL }, sharpMod, s3Mod] = await Promise.all([
    import("@grove/assets"),
    import("sharp"),
    import("@aws-sdk/client-s3"),
  ]);
  const sharp = sharpMod.default;
  const { S3Client, PutObjectCommand } = s3Mod;
  const config: SpacesAssetConfig = spacesConfigFromEnv(env);

  const normalize: MediaNormalizer = async (raw): Promise<NormalizedMedia> => {
    // Video: sharp can't re-encode video, so we pass the bytes through unchanged.
    // The privacy stop-ship is farm-PHOTO geotags; video is a rare/opt-in path
    // (GOL-716) and its container-metadata strip is deliberately out of scope here.
    if (raw.declaredType === "video") {
      return { bytes: raw.bytes, contentType: "video/mp4", type: "video" };
    }
    // Image: decode once, auto-orient from EXIF, downscale to the social cap, and
    // re-encode to WebP. sharp drops ALL metadata (incl. EXIF/GPS) on re-encode —
    // this is the privacy strip. Output kind/size are re-checked by the seam.
    const out = await sharp(Buffer.from(raw.bytes))
      .rotate()
      .resize({ width: SOCIAL_MAX_EDGE, height: SOCIAL_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: SOCIAL_WEBP_QUALITY })
      .toBuffer();
    return { bytes: new Uint8Array(out), contentType: "image/webp", type: "image" };
  };

  const s3 = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const store: AssetStore = {
    async put(key, bytes, contentType): Promise<string> {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          ACL: "public-read",
          CacheControl: CACHE_CONTROL,
        }),
      );
      return cdnUrlFor(config, key);
    },
  };

  return { store, normalize };
}
