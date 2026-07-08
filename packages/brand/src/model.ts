/**
 * Typed brand-entry model (ADR-009 Tier 4): brand → asset class → slug → CDN
 * key/URL. A brand's entries live in a single JSON registry file so a
 * `proposeBrandEntry` call becomes one deterministic file edit that a PR can
 * carry. Everything here is pure (no I/O, no clock) so it is trivially testable;
 * timestamps are passed in by the caller.
 */
import { isKnownBrand, isKnownClass, type AssetClass, type Brand } from "./taxonomy";

/** A single resolved brand asset: the CDN object plus the caption that named it. */
export interface BrandEntry {
  brand: Brand;
  assetClass: AssetClass;
  /** kebab slug derived from the caption description; unique within (brand, class). */
  slug: string;
  /** Spaces / CDN object key produced by the optimize+upload pipeline. */
  key: string;
  /** Public CDN URL for the optimized asset. */
  cdnUrl: string;
  /** Original human caption, e.g. "goldberry, logo, mark on cream". */
  caption: string;
  /** ISO-8601 timestamp of when this entry was last written. */
  updatedAt: string;
}

/** All asset entries for one brand — the shape of a `<brand>.json` registry file. */
export interface BrandAssetRegistry {
  brand: Brand;
  assets: BrandEntry[];
}

/** Registry file path (repo-relative) for a brand's typed asset entries. */
export function registryPath(brand: Brand): string {
  return `packages/brand/registry/${brand}.json`;
}

/** An empty registry for a brand, used when no file exists yet. */
export function emptyRegistry(brand: Brand): BrandAssetRegistry {
  return { brand, assets: [] };
}

/** Identity of an entry within a registry: unique per (assetClass, slug). */
function sameEntry(a: BrandEntry, b: { assetClass: AssetClass; slug: string }): boolean {
  return a.assetClass === b.assetClass && a.slug === b.slug;
}

/** Deterministic ordering so rendered files diff cleanly regardless of insert order. */
function compareEntries(a: BrandEntry, b: BrandEntry): number {
  return a.assetClass === b.assetClass
    ? a.slug.localeCompare(b.slug)
    : a.assetClass.localeCompare(b.assetClass);
}

export type UpsertKind = "added" | "updated" | "unchanged";

export interface UpsertResult {
  registry: BrandAssetRegistry;
  kind: UpsertKind;
}

/**
 * Insert or update `entry` in `registry`, keyed by (assetClass, slug). Returns a
 * new registry (input is not mutated) plus whether anything changed — an
 * identical re-entry reports `"unchanged"` so callers can skip opening a no-op PR.
 */
export function upsertBrandEntry(registry: BrandAssetRegistry, entry: BrandEntry): UpsertResult {
  if (entry.brand !== registry.brand) {
    throw new Error(`entry brand "${entry.brand}" does not match registry brand "${registry.brand}"`);
  }
  const existing = registry.assets.find((a) => sameEntry(a, entry));
  if (existing && entriesEquivalent(existing, entry)) {
    return { registry, kind: "unchanged" };
  }
  const assets = registry.assets.filter((a) => !sameEntry(a, entry));
  assets.push(entry);
  assets.sort(compareEntries);
  return { registry: { brand: registry.brand, assets }, kind: existing ? "updated" : "added" };
}

/** Two entries are equivalent if every field except `updatedAt` matches. */
function entriesEquivalent(a: BrandEntry, b: BrandEntry): boolean {
  return (
    a.brand === b.brand &&
    a.assetClass === b.assetClass &&
    a.slug === b.slug &&
    a.key === b.key &&
    a.cdnUrl === b.cdnUrl &&
    a.caption === b.caption
  );
}

/** Render a registry to canonical JSON (stable field order, 2-space, trailing newline). */
export function renderRegistry(registry: BrandAssetRegistry): string {
  const assets = [...registry.assets].sort(compareEntries).map((e) => ({
    brand: e.brand,
    assetClass: e.assetClass,
    slug: e.slug,
    key: e.key,
    cdnUrl: e.cdnUrl,
    caption: e.caption,
    updatedAt: e.updatedAt,
  }));
  return `${JSON.stringify({ brand: registry.brand, assets }, null, 2)}\n`;
}

/** Parse a registry file, validating the brand and each entry's taxonomy fields. */
export function parseRegistry(brand: Brand, json: string): BrandAssetRegistry {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`invalid registry JSON for "${brand}": ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`registry for "${brand}" must be an object`);
  }
  const obj = raw as { brand?: unknown; assets?: unknown };
  if (obj.brand !== brand) {
    throw new Error(`registry brand "${String(obj.brand)}" does not match expected "${brand}"`);
  }
  if (!Array.isArray(obj.assets)) {
    throw new Error(`registry for "${brand}" is missing an "assets" array`);
  }
  const assets = obj.assets.map((a, i) => coerceEntry(brand, a, i));
  return { brand, assets };
}

function coerceEntry(brand: Brand, value: unknown, index: number): BrandEntry {
  if (typeof value !== "object" || value === null) {
    throw new Error(`registry "${brand}" asset[${index}] is not an object`);
  }
  const e = value as Record<string, unknown>;
  const str = (field: string): string => {
    const v = e[field];
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`registry "${brand}" asset[${index}].${field} must be a non-empty string`);
    }
    return v;
  };
  const entryBrand = str("brand");
  if (!isKnownBrand(entryBrand) || entryBrand !== brand) {
    throw new Error(`registry "${brand}" asset[${index}].brand "${entryBrand}" is invalid`);
  }
  const assetClass = str("assetClass");
  if (!isKnownClass(assetClass)) {
    throw new Error(`registry "${brand}" asset[${index}].assetClass "${assetClass}" is unknown`);
  }
  return {
    brand: entryBrand,
    assetClass,
    slug: str("slug"),
    key: str("key"),
    cdnUrl: str("cdnUrl"),
    caption: str("caption"),
    updatedAt: str("updatedAt"),
  };
}
