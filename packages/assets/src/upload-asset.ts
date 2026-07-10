/**
 * upload-asset.ts — the single ADR-009 Tier-3 "optimize on ingest" recipe.
 *
 * Flow: source image bytes → sharp → responsive AVIF/WebP variants →
 *       content-hashed keys → grove-assets Spaces (public-read, immutable cache)
 *       → return the canonical CDN URL + key.
 *
 * This is the ONE optimize pipeline (ADR-009's "one optimize pipeline" rule):
 * both the Discord `#assets` ingest (AgenticOS GOL-92, which injects this as its
 * `AssetPipeline` seam) and manual CLI uploads (`cli.ts`) go through here so the
 * variant set, key naming, and cache policy never drift between callers.
 *
 * The S3/Spaces client is injected (`S3PutClient`) so the recipe is unit-testable
 * with a fake — no Spaces creds, no network. Credentials are never read here from
 * a shared env; callers pass a `SpacesAssetConfig` (see `spacesConfigFromEnv`,
 * which reads per-agent broker-injected `GROVE_ASSETS_*` vars per ADR-0001).
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/** Responsive widths generated for every asset (capped to the source width; never upscaled). */
export const RESPONSIVE_WIDTHS = [480, 768, 1200, 1920] as const;

/** Largest variant we ever store. A 6000px source still tops out at a 1920w object. */
export const MAX_WIDTH = 1920;

/** Output formats, smallest-first. AVIF wins on size; WebP is the broad-support primary. */
export const OUTPUT_FORMATS = ["avif", "webp"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const WEBP_QUALITY = 82;
const AVIF_QUALITY = 55;

/** Content-hashed keys are immutable, so we can cache them forever. */
export const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Number of hex chars of the sha256 content hash used in keys. */
const HASH_LEN = 12;

/** Input to the optimize+upload recipe. Mirrors the AgenticOS `AssetPipeline` seam (GOL-92). */
export interface AssetPipelineInput {
  bytes: Uint8Array;
  /** Original filename, kept for logging/diagnostics. Output naming is driven by `slug`. */
  filename: string;
  /** Brand namespace (Spaces key prefix), e.g. `goldberry`, `ggg`, `nursery`, `gather`. */
  brand: string;
  /** ADR-009 asset class, e.g. `hero`, `banner`, `logo`. */
  assetClass: string;
  /** Kebab slug derived from the caption description; names the CDN key. */
  slug: string;
}

export interface AssetVariant {
  key: string;
  cdnUrl: string;
  format: OutputFormat;
  width: number;
  bytes: number;
  contentType: string;
}

export interface AssetUploadResult {
  /** Canonical URL for the asset (largest WebP variant) — the one to show/link. */
  cdnUrl: string;
  /** Object key of the canonical variant. */
  key: string;
  /** Every uploaded variant (both formats, all widths). */
  variants: AssetVariant[];
  /** sha256(source) prefix used in the keys — stable across re-uploads of the same bytes. */
  hash: string;
}

/** The optimize+upload seam GOL-92 binds to. Return type is a structural superset of `{cdnUrl,key}`. */
export interface AssetPipeline {
  optimizeAndUpload(input: AssetPipelineInput): Promise<AssetUploadResult>;
}

/** Minimal S3 client surface — anything with `send`. Lets tests inject a fake. */
export interface S3PutClient {
  send(command: unknown): Promise<unknown>;
}

export interface SpacesAssetConfig {
  bucket: string;
  region: string;
  /** Regional Spaces endpoint, e.g. `https://nyc3.digitaloceanspaces.com`. */
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public CDN base for returned URLs, e.g. `https://assets.gatheringatthegrove.com` (no trailing slash needed). */
  cdnBaseUrl: string;
}

/** First `HASH_LEN` hex chars of the sha256 of the source bytes. Deterministic ⇒ idempotent keys. */
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LEN);
}

/** Lowercase, hyphenate, and strip a single path segment. Never empty (falls back to `asset`). */
export function sanitizeSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}

/**
 * Widths to generate for a given source width: every responsive width strictly
 * below the cap, plus the cap itself (`min(sourceWidth, MAX_WIDTH)`). Never upscales,
 * always yields at least one full-resolution (capped) variant.
 */
export function targetWidths(sourceWidth: number): number[] {
  const cap = Math.min(Math.max(1, Math.floor(sourceWidth)), MAX_WIDTH);
  const widths: number[] = RESPONSIVE_WIDTHS.filter((w) => w < cap);
  widths.push(cap);
  return [...new Set(widths)].sort((a, b) => a - b);
}

/** `brand/class/slug-<hash>-<width>w.<format>` — the single source of key naming. */
export function assetKey(
  input: Pick<AssetPipelineInput, "brand" | "assetClass" | "slug">,
  width: number,
  format: OutputFormat,
  hash: string,
): string {
  const brand = sanitizeSegment(input.brand);
  const cls = sanitizeSegment(input.assetClass);
  const slug = sanitizeSegment(input.slug);
  return `${brand}/${cls}/${slug}-${hash}-${width}w.${format}`;
}

export function cdnUrlFor(config: Pick<SpacesAssetConfig, "cdnBaseUrl">, key: string): string {
  return `${config.cdnBaseUrl.replace(/\/+$/, "")}/${key}`;
}

interface EncodedVariant {
  buffer: Buffer;
  width: number;
  format: OutputFormat;
  contentType: string;
}

/**
 * Decode the source once, then encode responsive AVIF + WebP variants. Pure w.r.t. I/O
 * (no network, no Spaces) so it can be tested and reasoned about on its own.
 * Auto-orients via EXIF (`rotate()`) before sharp strips metadata on output.
 */
export async function optimizeToVariants(bytes: Uint8Array): Promise<EncodedVariant[]> {
  const src = Buffer.from(bytes);
  const meta = await sharp(src).metadata();
  const sourceWidth = meta.width ?? MAX_WIDTH;
  const widths = targetWidths(sourceWidth);

  const variants: EncodedVariant[] = [];
  for (const width of widths) {
    for (const format of OUTPUT_FORMATS) {
      const base = sharp(src)
        .rotate()
        .resize({ width, withoutEnlargement: true });
      const buffer =
        format === "webp"
          ? await base.webp({ quality: WEBP_QUALITY }).toBuffer()
          : await base.avif({ quality: AVIF_QUALITY }).toBuffer();
      variants.push({ buffer, width, format, contentType: `image/${format}` });
    }
  }
  return variants;
}

/** The canonical variant to link/show: the largest WebP (broad support), else the largest overall. */
export function pickPrimary(variants: AssetVariant[]): AssetVariant {
  if (variants.length === 0) throw new Error("upload-asset: no variants produced");
  const webps = variants.filter((v) => v.format === "webp");
  const pool = webps.length > 0 ? webps : variants;
  return pool.reduce((widest, v) => (v.width > widest.width ? v : widest));
}

/**
 * Optimize `input.bytes` and upload every variant to Spaces (public-read, immutable cache).
 * Idempotent: content-hashed keys mean re-uploading the same image overwrites in place.
 */
export async function uploadAsset(
  client: S3PutClient,
  config: SpacesAssetConfig,
  input: AssetPipelineInput,
): Promise<AssetUploadResult> {
  const hash = contentHash(input.bytes);
  const encoded = await optimizeToVariants(input.bytes);

  const variants: AssetVariant[] = [];
  for (const v of encoded) {
    const key = assetKey(input, v.width, v.format, hash);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: v.buffer,
        ContentType: v.contentType,
        ACL: "public-read",
        CacheControl: CACHE_CONTROL,
      }),
    );
    variants.push({
      key,
      cdnUrl: cdnUrlFor(config, key),
      format: v.format,
      width: v.width,
      bytes: v.buffer.length,
      contentType: v.contentType,
    });
  }

  const primary = pickPrimary(variants);
  return { cdnUrl: primary.cdnUrl, key: primary.key, variants, hash };
}

/**
 * Build an `AssetPipeline` bound to a real (or injected) Spaces client.
 * AgenticOS GOL-92 binds the returned object as its injected pipeline.
 */
export function createSpacesAssetPipeline(
  config: SpacesAssetConfig,
  client?: S3PutClient,
): AssetPipeline {
  const s3: S3PutClient =
    client ??
    new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  return {
    optimizeAndUpload: (input) => uploadAsset(s3, config, input),
  };
}

/**
 * Read Spaces config from the environment. Credentials come from the per-agent
 * secret broker (ADR-0001) as `GROVE_ASSETS_KEY` / `GROVE_ASSETS_SECRET` and are
 * never committed or placed in the shared agent env. Non-secret settings default
 * to the known grove-assets bucket / CDN host.
 */
export function spacesConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SpacesAssetConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) {
      throw new Error(
        `upload-asset: missing required env ${name} (provisioned via the secret broker per ADR-0001)`,
      );
    }
    return value;
  };
  return {
    bucket: env.GROVE_ASSETS_BUCKET ?? "grove-assets",
    region: env.GROVE_ASSETS_REGION ?? "nyc3",
    endpoint: env.GROVE_ASSETS_ENDPOINT ?? "https://nyc3.digitaloceanspaces.com",
    accessKeyId: required("GROVE_ASSETS_KEY"),
    secretAccessKey: required("GROVE_ASSETS_SECRET"),
    cdnBaseUrl: env.GROVE_ASSETS_CDN_BASE ?? "https://assets.gatheringatthegrove.com",
  };
}
