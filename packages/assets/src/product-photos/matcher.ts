/**
 * matcher.ts — filename → product-slug matching for the product-photo ingest
 * (`scripts/upload-asset.ts`, ADR-009 "product/catalog images → Odoo" tier).
 *
 * Filename convention (family-facing):
 *
 *   <grove_slug>[-<variant-hint>][-<n>].(jpg|jpeg|png|webp)
 *
 *   pawpaw-mango.jpg           → primary photo for grove_slug "pawpaw-mango"
 *   pawpaw-mango-2.jpg         → 2nd (gallery) photo for the same product
 *   pawpaw-mango-potted.jpg    → photo for the "Potted" variant
 *   pawpaw-mango-potted-2.jpg  → 2nd gallery photo, labeled by the hint
 *
 * Slugs themselves contain hyphens, so parsing is resolved against the live
 * slug list fetched from Odoo: the LONGEST known slug that prefixes the
 * filename (on a token boundary) wins, and whatever remains is interpreted as
 * an optional variant hint plus an optional trailing sequence number.
 * A file that matches no known slug is reported as unmatched — never guessed.
 */

/** Extensions the ingest accepts (case-insensitive). */
export const SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export interface MatchedFile {
  /** Source filename (basename, as given). */
  file: string;
  /** The resolved grove_slug (longest known-slug prefix). */
  slug: string;
  /** Kebab variant hint between the slug and the sequence number, or null. */
  variantHint: string | null;
  /** Trailing sequence number (1 = primary slot), or null (equivalent to 1). */
  sequence: number | null;
}

export interface UnmatchedFile {
  file: string;
  reason: string;
}

export interface MatchResult {
  matched: MatchedFile[];
  unmatched: UnmatchedFile[];
}

/** Lowercase-kebab a value the same way grove slugs are formed. */
export function kebab(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse one filename against the known slug list.
 * Returns a MatchedFile or an UnmatchedFile with a human-readable reason.
 */
export function parseFilename(
  file: string,
  knownSlugs: readonly string[],
): MatchedFile | UnmatchedFile {
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot + 1).toLowerCase() : "";
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      file,
      reason: `unsupported extension ".${ext || "(none)"}" — use ${SUPPORTED_EXTENSIONS.join("/")}`,
    };
  }

  const base = kebab(file.slice(0, dot));
  if (!base) return { file, reason: "empty filename" };

  // Longest known slug that is the whole base or a token-boundary prefix of it.
  let slug: string | null = null;
  for (const candidate of knownSlugs) {
    if (base === candidate || base.startsWith(`${candidate}-`)) {
      if (slug === null || candidate.length > slug.length) slug = candidate;
    }
  }
  if (slug === null) {
    return {
      file,
      reason: "no product slug matches — name the file <product-slug>.jpg (see --match-report)",
    };
  }

  const remainder = base === slug ? "" : base.slice(slug.length + 1);
  if (remainder === "") {
    return { file, slug, variantHint: null, sequence: null };
  }

  const tokens = remainder.split("-");
  const last = tokens[tokens.length - 1]!;
  let sequence: number | null = null;
  let hintTokens = tokens;
  if (/^\d+$/.test(last)) {
    sequence = Number.parseInt(last, 10);
    hintTokens = tokens.slice(0, -1);
    if (sequence < 1) {
      return { file, reason: `sequence number must be >= 1 (got ${sequence})` };
    }
  }

  const variantHint = hintTokens.length > 0 ? hintTokens.join("-") : null;
  return { file, slug, variantHint, sequence };
}

/** Parse a batch of filenames; splits into matched / unmatched. */
export function matchFiles(
  files: readonly string[],
  knownSlugs: readonly string[],
): MatchResult {
  const matched: MatchedFile[] = [];
  const unmatched: UnmatchedFile[] = [];
  for (const file of [...files].sort()) {
    const result = parseFilename(file, knownSlugs);
    if ("reason" in result) unmatched.push(result);
    else matched.push(result);
  }
  return { matched, unmatched };
}
