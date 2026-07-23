/**
 * image.ts — the one processing step for ingested product photos.
 *
 * Family phone photos come in huge, EXIF-laden (including GPS), and in mixed
 * formats. Every photo is normalized before it touches Odoo:
 *   - auto-orient via EXIF, then STRIP all metadata (sharp drops EXIF/GPS on
 *     re-encode unless `withMetadata()` is called — it isn't)
 *   - resize to at most 1600px on the long edge (never upscale)
 *   - encode WebP at the repo's standard quality (82, same as upload-asset.ts)
 *
 * Output is deterministic for the same input bytes + sharp version, which is
 * what makes hash-based idempotency in the planner work.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";

/** Max long-edge dimension for ingested product photos. */
export const MAX_LONG_EDGE = 1600;

/** WebP quality — matches the Tier-3 Spaces pipeline (upload-asset.ts). */
export const PRODUCT_WEBP_QUALITY = 82;

export interface ProcessedImage {
  bytes: Buffer;
  /** sha256-hex of the processed bytes (full length). */
  hash: string;
  width: number;
  height: number;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Normalize one source photo: orient → resize (≤1600 long edge) → WebP, EXIF stripped. */
export async function processProductPhoto(source: Uint8Array): Promise<ProcessedImage> {
  const bytes = await sharp(Buffer.from(source))
    .rotate() // bake EXIF orientation in before metadata is dropped
    .resize({
      width: MAX_LONG_EDGE,
      height: MAX_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PRODUCT_WEBP_QUALITY })
    .toBuffer();
  const meta = await sharp(bytes).metadata();
  return {
    bytes,
    hash: sha256Hex(bytes),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
