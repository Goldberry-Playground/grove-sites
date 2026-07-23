/**
 * planner.ts — pure dry-run planner for the product-photo ingest.
 *
 * Turns matched files + the fetched catalog (+ optionally the current Odoo
 * image state) into an explicit per-file plan. No I/O here: the CLI fetches
 * catalog/state and executes writes; this module only decides, so the whole
 * decision surface is unit-testable without a network.
 *
 * Slot model (ADR-009 routes product/catalog images to Odoo; the ADR is
 * silent on primary-vs-gallery, so this mirrors what grove_headless serves):
 *   - primary  → product.template.image_1920 (the template "hero";
 *                `_serialize_images` puts it first)
 *   - gallery  → product.image rows in product_template_image_ids (seq >= 2)
 *   - variant  → product.product.image_variant_1920 (variant-hinted files)
 *
 * Idempotency:
 *   - primary / variant writes overwrite a single field — re-running with the
 *     same file can never duplicate. When the current image hash is known
 *     (apply mode reads it back), an identical image is planned as a skip.
 *   - gallery rows CAN duplicate, so each row's `name` embeds the source
 *     basename plus a content-hash marker: "<file> [grove-ingest <hash12>]".
 *     Same basename + same hash → skip; same basename + new hash → update the
 *     existing row in place; unknown basename → create.
 */
import type { MatchedFile } from "./matcher";
import { kebab } from "./matcher";

export interface CatalogVariant {
  id: number;
  displayName: string;
  /** Format axis value, e.g. "Potted" / "Bareroot" ("" when absent). */
  format: string;
  /** Cultivar axis value ("" when absent). */
  cultivar: string;
}

export interface CatalogProduct {
  id: number;
  slug: string;
  name: string;
  /** Only populated (by the CLI) for products that have variant-hinted files. */
  variants?: CatalogVariant[];
}

/** A gallery row already in Odoo, as read back in apply mode. */
export interface ExistingGalleryRow {
  id: number;
  name: string;
}

/** Current Odoo image state (apply mode only; omit for a pure dry-run plan). */
export interface ExistingState {
  /** sha256-hex of the current product.template.image_1920, keyed by product id ("" = unset). */
  primaryHashByProduct?: Record<number, string>;
  /** product.image rows per product id. */
  galleryByProduct?: Record<number, ExistingGalleryRow[]>;
  /** sha256-hex of the current product.product.image_variant_1920, keyed by variant id ("" = unset). */
  variantHashByVariant?: Record<number, string>;
}

export type PlannedOp =
  | { kind: "set-primary"; productId: number }
  | { kind: "set-variant-image"; productId: number; variantId: number; variantName: string }
  | {
      kind: "add-gallery";
      productId: number;
      /** product.image `name` to write (basename + hash marker when hash known). */
      galleryName: string;
      /** Existing row to update in place (same basename, different content). */
      updateRowId?: number;
    };

export interface PlannedFile {
  file: string;
  slug: string;
  productId: number;
  productName: string;
  op: PlannedOp;
  status: "write" | "skip";
  /** Why a skip is a skip (present when status === "skip"). */
  reason?: string;
}

export interface PlanProblem {
  file: string;
  reason: string;
}

export interface IngestPlan {
  planned: PlannedFile[];
  problems: PlanProblem[];
}

/** Number of content-hash hex chars embedded in gallery row names. */
export const GALLERY_HASH_LEN = 12;

const GALLERY_MARKER = /^(.*) \[grove-ingest ([0-9a-f]+)\]$/;

/** Gallery row name for a source file: "<file> [grove-ingest <hash12>]". */
export function galleryName(file: string, hash?: string): string {
  return hash ? `${file} [grove-ingest ${hash.slice(0, GALLERY_HASH_LEN)}]` : file;
}

/** Parse "<file> [grove-ingest <hash>]" back into its parts (null if unmarked). */
export function parseGalleryName(name: string): { file: string; hash: string } | null {
  const m = GALLERY_MARKER.exec(name);
  return m ? { file: m[1]!, hash: m[2]! } : null;
}

/** Resolve a kebab variant hint against a product's variants. */
export function resolveVariantHint(
  hint: string,
  variants: readonly CatalogVariant[],
): { variant?: CatalogVariant; error?: string } {
  const candidates = variants.filter((v) => {
    const format = kebab(v.format);
    const cultivar = kebab(v.cultivar);
    return (
      hint === format ||
      hint === cultivar ||
      (cultivar !== "" && format !== "" && hint === `${cultivar}-${format}`)
    );
  });
  if (candidates.length === 1) return { variant: candidates[0]! };
  if (candidates.length === 0) {
    const axes = variants
      .map((v) => [kebab(v.cultivar), kebab(v.format)].filter(Boolean).join("-"))
      .filter(Boolean);
    return {
      error: `variant hint "${hint}" matches no variant (known: ${axes.length ? axes.join(", ") : "none"})`,
    };
  }
  return {
    error: `variant hint "${hint}" is ambiguous (${candidates.length} variants match)`,
  };
}

/**
 * Build the ingest plan.
 *
 * @param matches  parsed filenames (from matcher.ts)
 * @param catalog  products fetched from Odoo (slug → id; variants where needed)
 * @param hashes   sha256-hex of each PROCESSED image, keyed by filename
 *                 (apply mode; omit in dry-run — skips can't be detected without it)
 * @param existing current Odoo image state (apply mode; omit in dry-run)
 */
export function planIngest(
  matches: readonly MatchedFile[],
  catalog: readonly CatalogProduct[],
  hashes?: Record<string, string>,
  existing?: ExistingState,
): IngestPlan {
  const bySlug = new Map(catalog.map((p) => [p.slug, p]));
  const planned: PlannedFile[] = [];
  const problems: PlanProblem[] = [];

  // Detect two files claiming the same primary slot (e.g. x.jpg AND x-1.jpg).
  const primaryClaims = new Map<string, string>(); // "slug" or "slug#variantHint" → file
  const slotKey = (m: MatchedFile) => (m.variantHint ? `${m.slug}#${m.variantHint}` : m.slug);

  for (const m of [...matches].sort((a, b) => a.file.localeCompare(b.file))) {
    const product = bySlug.get(m.slug);
    if (!product) {
      problems.push({ file: m.file, reason: `slug "${m.slug}" not in fetched catalog` });
      continue;
    }

    const seq = m.sequence ?? 1;
    const hash = hashes?.[m.file];

    if (seq === 1) {
      const key = slotKey(m);
      const holder = primaryClaims.get(key);
      if (holder) {
        problems.push({
          file: m.file,
          reason: `both "${holder}" and "${m.file}" claim the same primary slot — keep one, or number the extras -2, -3, …`,
        });
        continue;
      }
      primaryClaims.set(key, m.file);
    }

    if (m.variantHint !== null && seq === 1) {
      // Variant image slot.
      if (!product.variants) {
        problems.push({
          file: m.file,
          reason: `variant hint "${m.variantHint}" but no variants loaded for "${m.slug}"`,
        });
        continue;
      }
      const { variant, error } = resolveVariantHint(m.variantHint, product.variants);
      if (!variant) {
        problems.push({ file: m.file, reason: error! });
        continue;
      }
      const current = existing?.variantHashByVariant?.[variant.id];
      const identical = hash !== undefined && current !== undefined && current === hash;
      planned.push({
        file: m.file,
        slug: m.slug,
        productId: product.id,
        productName: product.name,
        op: {
          kind: "set-variant-image",
          productId: product.id,
          variantId: variant.id,
          variantName: variant.displayName,
        },
        status: identical ? "skip" : "write",
        ...(identical ? { reason: "variant image already up to date" } : {}),
      });
      continue;
    }

    if (seq === 1) {
      // Primary (template hero) slot.
      const current = existing?.primaryHashByProduct?.[product.id];
      const identical = hash !== undefined && current !== undefined && current === hash;
      planned.push({
        file: m.file,
        slug: m.slug,
        productId: product.id,
        productName: product.name,
        op: { kind: "set-primary", productId: product.id },
        status: identical ? "skip" : "write",
        ...(identical ? { reason: "primary image already up to date" } : {}),
      });
      continue;
    }

    // seq >= 2 → gallery row (variant-hinted or not — the hint just stays in the name).
    const rows = existing?.galleryByProduct?.[product.id] ?? [];
    const existingRow = rows.find((r) => {
      const parsed = parseGalleryName(r.name);
      return (parsed?.file ?? r.name) === m.file;
    });
    if (existingRow && hash !== undefined) {
      const parsed = parseGalleryName(existingRow.name);
      if (parsed && parsed.hash === hash.slice(0, GALLERY_HASH_LEN)) {
        planned.push({
          file: m.file,
          slug: m.slug,
          productId: product.id,
          productName: product.name,
          op: { kind: "add-gallery", productId: product.id, galleryName: existingRow.name },
          status: "skip",
          reason: "gallery image already up to date",
        });
        continue;
      }
    }
    planned.push({
      file: m.file,
      slug: m.slug,
      productId: product.id,
      productName: product.name,
      op: {
        kind: "add-gallery",
        productId: product.id,
        galleryName: galleryName(m.file, hash),
        ...(existingRow ? { updateRowId: existingRow.id } : {}),
      },
      status: "write",
    });
  }

  return { planned, problems };
}
