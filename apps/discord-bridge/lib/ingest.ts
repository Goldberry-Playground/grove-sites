/**
 * ingest.ts — the social-media media re-host / ingest seam (GOL-1119, Phase 4).
 *
 * The front door of the CMO content pipeline: turn a raw file an operator drops
 * (a Discord attachment or a Drive file) into a durable, publicly-fetchable
 * https URL that satisfies the existing {@link MediaAsset} contract, so it plugs
 * straight into the already-shipped approval-card → Buffer path (GOL-470/716/718).
 *
 * See docs/SOCIAL-MEDIA-INGEST-SPIKE.md (GOL-472). This module is the ONLY new
 * seam; everything downstream (caption/hashtag assist, preview card,
 * approve/revise/reject, Buffer scheduling with media) already ships.
 *
 * Design (why this shape):
 *  - {@link AssetStore} is an interface, so the Odoo-filestore-vs-DO-Spaces
 *    backend decision (blocked on DevOps-Terra + the ADR-009 amendment) is a
 *    one-line wiring change, not a rewrite. This core does not depend on it.
 *  - The image {@link MediaNormalizer} is injected too, so the sharp-backed
 *    EXIF/GPS-strip recipe (reuse `@grove/assets` `processProductPhoto`, ported
 *    from `scripts/upload-asset.ts`) is wired at the front door and this core
 *    stays pure + unit-testable with no native/image/network dependency.
 *  - Output is a validated {@link MediaAsset}: {@link rehostToMediaAsset} returns
 *    only URLs that pass {@link validateMediaAsset} by construction (https,
 *    durable, no short-lived signed-URL markers) — re-host, never proxy the
 *    raw Discord/Drive signed URL.
 *
 * Security must-haves enforced here (all pure, all tested):
 *  - EXIF/GPS strip: privacy stop-ship (family phone geotags → a public post).
 *    The normalizer strips; this core requires the normalizer for every asset
 *    and re-checks its output kind/size, so nothing reaches the store un-normalized.
 *  - Content-type allowlist: image/jpeg|png|webp, video/mp4 — reject others loud.
 *  - Max-size cap aligned to IG/Buffer limits — reject early, before normalizing.
 *  - Content-hash key → idempotent re-uploads (a re-drop doesn't duplicate).
 * Approver-only upload and no-auto-post are enforced by the callers (the existing
 * `approverIds` allowlist and the approval card); this seam only ever *proposes*.
 */
import { createHash } from "node:crypto";

import type { IgPostType, MediaAsset, MediaSource, MediaType } from "./media";
import { validateMediaAsset } from "./media";

/** A raw file dropped by an operator, before any normalization/re-host. */
export interface RawUpload {
  /** The raw file bytes (fetched from the Discord CDN / Drive by the front door). */
  bytes: Uint8Array;
  /** Original filename — used for extension/content-type inference only. */
  filename: string;
  /** The media kind the operator/front-door declares. Cross-checked below. */
  declaredType: MediaType;
  /** Provenance for analytics/attribution. "manual" farm photo; "canva" re-host. */
  source: MediaSource;
}

/** Normalized, EXIF-stripped bytes ready to store. */
export interface NormalizedMedia {
  bytes: Uint8Array;
  /** Actual content-type of the normalized bytes (e.g. image → "image/webp"). */
  contentType: string;
  /** Media kind of the normalized bytes; must equal the declared kind. */
  type: MediaType;
}

/**
 * Strip metadata (EXIF/GPS), normalize, and re-encode a raw upload. MUST drop
 * all EXIF/GPS — this is the privacy stop-ship. For images, the concrete impl
 * is `@grove/assets` `processProductPhoto` (sharp: orient → resize ≤1600 →
 * WebP, metadata dropped on re-encode). Injected so this core stays pure.
 */
export type MediaNormalizer = (raw: RawUpload) => Promise<NormalizedMedia>;

/** Pluggable durable object store. The Odoo-vs-Spaces choice is one impl of this. */
export interface AssetStore {
  /** Store bytes under `key`, return a durable, public, https URL. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

/** Dependencies for {@link rehostToMediaAsset}: the store + the strip/normalize step. */
export interface IngestDeps {
  store: AssetStore;
  normalize: MediaNormalizer;
}

export interface RehostOptions {
  /** IG surface; defaults to "post". "reel" requires a video asset. */
  igPostType?: IgPostType;
  /** Accessibility + brand alt text (recommended). */
  altText?: string;
  /** Key prefix inside the store. Defaults to "social". */
  keyPrefix?: string;
}

/** Content-type → media kind allowlist. Anything not here is rejected loud. */
const ALLOWED_CONTENT_TYPES: Readonly<Record<string, MediaType>> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
};

/** Filename extension → content-type, for inferring the *input* content-type. */
const EXT_TO_CONTENT_TYPE: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

/** Content-type → stored-file extension, for building the (hash-based) key. */
const CONTENT_TYPE_TO_EXT: Readonly<Record<string, string>> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
};

/** Max stored image size — IG feed image cap; reject larger before normalizing. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Max stored video size — conservative IG feed cap (reels run higher). */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Hash length used in the storage key — enough to avoid collisions, short URLs. */
const KEY_HASH_LEN = 32;

export class IngestError extends Error {
  constructor(message: string) {
    super(`social-ingest: ${message}`);
    this.name = "IngestError";
  }
}

function sizeCap(type: MediaType): number {
  return type === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

/**
 * Infer the input content-type from the filename and cross-check it against the
 * declared media kind. Rejects unknown extensions and kind mismatches loud, so
 * a mislabelled drop (e.g. `.mp4` declared as an image) never proceeds.
 */
export function inferInputContentType(filename: string, declaredType: MediaType): string {
  const ext = fileExtension(filename);
  const contentType = EXT_TO_CONTENT_TYPE[ext];
  if (!contentType) {
    throw new IngestError(
      `unsupported file extension "${ext || "(none)"}" for "${filename}" — ` +
        `allowed: ${Object.keys(EXT_TO_CONTENT_TYPE).join(", ")}`,
    );
  }
  const kind = ALLOWED_CONTENT_TYPES[contentType];
  if (kind !== declaredType) {
    throw new IngestError(
      `"${filename}" is a ${kind} but was declared as ${declaredType}`,
    );
  }
  return contentType;
}

/** Assert a content-type is on the allowlist; return its media kind. */
export function assertAllowedContentType(contentType: string): MediaType {
  const kind = ALLOWED_CONTENT_TYPES[contentType];
  if (!kind) {
    throw new IngestError(
      `disallowed content-type "${contentType}" — allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(", ")}`,
    );
  }
  return kind;
}

/** Assert `bytes` is within the cap for `type` (and non-empty). */
export function assertWithinSizeCap(bytes: Uint8Array, type: MediaType): void {
  if (bytes.length === 0) throw new IngestError("empty file (0 bytes)");
  const cap = sizeCap(type);
  if (bytes.length > cap) {
    throw new IngestError(
      `${type} is ${bytes.length} bytes, over the ${cap}-byte cap — reject before storing`,
    );
  }
}

/** Deterministic content-hash storage key: `<prefix>/<sha256>.<ext>`. */
export function contentHashKey(bytes: Uint8Array, contentType: string, prefix = "social"): string {
  const ext = CONTENT_TYPE_TO_EXT[contentType] ?? "";
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, KEY_HASH_LEN);
  return `${prefix}/${hash}${ext}`;
}

/**
 * Re-host a raw operator upload to a durable public URL and return a validated
 * {@link MediaAsset} ready for the existing approval-card → Buffer flow.
 *
 * Order matters for safety: allowlist + size are checked on the *input* before
 * we spend work normalizing, and the normalizer output is re-checked (kind,
 * content-type, size) before it reaches the store — so nothing un-normalized or
 * oversized is ever stored, and the media kind can't silently change. The final
 * {@link validateMediaAsset} guarantees the returned URL is https + durable +
 * free of short-lived signed-URL markers (guards against a store that mistakenly
 * hands back a proxied signed URL).
 *
 * Throws {@link IngestError} (or the media contract error) on any violation —
 * fail loud at ingest time, never silently at Buffer publish time.
 */
export async function rehostToMediaAsset(
  raw: RawUpload,
  deps: IngestDeps,
  opts: RehostOptions = {},
): Promise<MediaAsset> {
  // 1. Validate the input cheaply, before any work.
  const inputContentType = inferInputContentType(raw.filename, raw.declaredType);
  assertAllowedContentType(inputContentType);
  assertWithinSizeCap(raw.bytes, raw.declaredType);

  // 2. Strip EXIF/GPS + normalize (privacy stop-ship). Injected recipe.
  const normalized = await deps.normalize(raw);

  // 3. Re-validate the normalizer's output before it can be stored.
  const normalizedKind = assertAllowedContentType(normalized.contentType);
  if (normalized.type !== normalizedKind) {
    throw new IngestError(
      `normalizer returned type "${normalized.type}" that disagrees with content-type "${normalized.contentType}"`,
    );
  }
  if (normalized.type !== raw.declaredType) {
    throw new IngestError(
      `normalizer changed the media kind: declared ${raw.declaredType}, got ${normalized.type}`,
    );
  }
  assertWithinSizeCap(normalized.bytes, normalized.type);

  // 4. Store under a content-hash key (idempotent) → durable public URL.
  const key = contentHashKey(normalized.bytes, normalized.contentType, opts.keyPrefix);
  const url = await deps.store.put(key, normalized.bytes, normalized.contentType);

  // 5. Build + strictly validate the MediaAsset (https/durable/no signed markers).
  const asset = validateMediaAsset({
    url,
    type: normalized.type,
    source: raw.source,
    igPostType: opts.igPostType,
    altText: opts.altText,
  });
  if (!asset) {
    // validateMediaAsset only returns undefined for null/undefined input, which
    // we never pass — this is a defensive guard so the return type is MediaAsset.
    throw new IngestError("media validation unexpectedly produced no asset");
  }
  return asset;
}
