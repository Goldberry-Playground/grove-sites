import type { Product } from "@grove/odoo-client";

/**
 * Facet-sidebar model for /shop (design spec §"Mechanics — Facets").
 *
 * URL contract (shareable / indexable):
 *   ?cat=<slug>    plant type  — the established category contract (CategoryBar
 *                  and the homepage already link with `cat`; kept as the single
 *                  source of truth rather than the spec's aspirational `type`).
 *   ?zone=<int>    USDA hardiness zone — applied SERVER-SIDE via the catalog
 *                  API `zone` param (zone_min ≤ z ≤ zone_max); list items don't
 *                  carry zones, so it can't be filtered client-side.
 *   ?tag=<slug>    cross-cutting usage tag(s) — repeatable; applied client-side
 *                  against each product's `tags[]` with AND semantics.
 *   ?layer=<v>     food-forest layer (`grove_layer`) — applied SERVER-SIDE via
 *                  the catalog API `layer` param. Like `zone`, list items don't
 *                  carry facts, so this filters at the source (grove_headless).
 *   ?sun=<v>       sun requirement (`grove_sun`) — applied SERVER-SIDE via the
 *                  catalog API `sun` param, same as `layer`.
 */

/** USDA zones the nursery ships to. Static because list items carry no zones;
 * the option a buyer picks is handed to the API's `zone` filter. */
export const ZONE_OPTIONS = [3, 4, 5, 6, 7, 8, 9] as const;

/** Food-forest layer facet values (`grove_layer` selection in grove_headless).
 * Handed to the catalog API's `layer` filter; kept static so an out-of-range
 * URL param can be dropped rather than round-tripped. */
export const LAYER_OPTIONS = ["canopy", "understory", "shrub", "ground", "vine"] as const;

/** Sun-requirement facet values (`grove_sun` selection). Handed to the catalog
 * API's `sun` filter. */
export const SUN_OPTIONS = ["full", "partial", "shade"] as const;

export interface FacetParams {
  /** Plant-type category slug (existing `cat` contract). */
  cat: string | null;
  /** USDA zone — applied server-side by the caller via `products.list({zone})`. */
  zone: number | null;
  /** Selected usage tags (AND-combined). */
  tags: string[];
  /** Food-forest layer — applied server-side via `products.list({layer})`. */
  layer: string | null;
  /** Sun requirement — applied server-side via `products.list({sun})`. */
  sun: string | null;
  /**
   * Free-text catalog search (`?q=`) — a shareable, indexable query applied
   * CLIENT-SIDE against the fetched set (name + botanical + tags). Deep catalogs
   * (the Apple bucket alone carries dozens of varieties) need find-by-name so a
   * shopper isn't forced to scroll or facet their way to a known cultivar.
   */
  q: string | null;
}

type RawParam = string | string[] | undefined;

function firstString(v: RawParam): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function stringList(v: RawParam): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v.length > 0) return v.split(",").filter(Boolean);
  return [];
}

/** Parse Next.js `searchParams` into a typed, normalized facet selection. */
export function parseFacetParams(sp: Record<string, RawParam>): FacetParams {
  const rawZone = firstString(sp.zone);
  const zone = rawZone !== null && /^\d+$/.test(rawZone) ? Number(rawZone) : null;
  const rawLayer = firstString(sp.layer);
  const rawSun = firstString(sp.sun);
  return {
    cat: firstString(sp.cat),
    zone: zone !== null && ZONE_OPTIONS.includes(zone as (typeof ZONE_OPTIONS)[number]) ? zone : null,
    tags: stringList(sp.tag),
    layer:
      rawLayer !== null && (LAYER_OPTIONS as readonly string[]).includes(rawLayer) ? rawLayer : null,
    sun: rawSun !== null && (SUN_OPTIONS as readonly string[]).includes(rawSun) ? rawSun : null,
    q: normalizeQuery(firstString(sp.q)),
  };
}

/** Trim a raw `q` param to a bounded search string, or null when blank. Bounded
 *  so a pathological URL can't drive an unbounded scan. */
export function normalizeQuery(raw: string | null): string | null {
  const q = (raw ?? "").trim().slice(0, 80);
  return q.length > 0 ? q : null;
}

/**
 * AND-filter a product list by a free-text query. Each whitespace-separated term
 * must appear (case-insensitively) somewhere in the product's searchable text —
 * name, botanical/plant-type (`categoryName`), or its cross-cutting tags — so
 * "dwarf apple" narrows to dwarf apples rather than matching either word alone.
 * Empty/blank query is a no-op. Botanical + cultivar names live on the variant
 * payload (not list items), so deep cultivar-name matching is a backend
 * follow-up; name + type + tags covers the QA "find a variety" case today.
 */
export function applySearchFilter(products: Product[], q: string | null): Product[] {
  const query = (q ?? "").trim().toLowerCase();
  if (!query) return products;
  const terms = query.split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const haystack = [p.name, p.categoryName, ...(p.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/**
 * Build a `/shop` href that PRESERVES the current facet selection while changing
 * one axis. The CategoryBar pills used to link to a bare `/shop?cat=<slug>`,
 * silently dropping an active zone/layer/sun/tag/search selection — switching
 * plant type wiped the shopper's other filters (QA 2026-07-31). This merges the
 * kept axes so only the patched one changes; an axis set to `null` in `patch`
 * is cleared. Omitting `preserve` (the homepage, which has no facets) yields the
 * previous bare hrefs.
 */
export function buildShopHref(
  patch: { cat?: string | null },
  preserve?: Partial<FacetParams> | null,
): string {
  const params = new URLSearchParams();
  const cat = "cat" in patch ? patch.cat : preserve?.cat ?? null;
  if (cat) params.set("cat", cat);
  if (preserve) {
    if (preserve.zone != null) params.set("zone", String(preserve.zone));
    if (preserve.layer) params.set("layer", preserve.layer);
    if (preserve.sun) params.set("sun", preserve.sun);
    if (preserve.q) params.set("q", preserve.q);
    for (const t of preserve.tags ?? []) params.append("tag", t);
  }
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

/** AND-filter a product list by selected usage tags. Empty selection → no-op. */
export function applyTagFilter(products: Product[], tags: string[]): Product[] {
  if (tags.length === 0) return products;
  return products.filter((p) => {
    const owned = new Set(p.tags ?? []);
    return tags.every((t) => owned.has(t));
  });
}

export interface FacetOption {
  value: string;
  count: number;
  active: boolean;
}

/**
 * Build the tag-facet options from the currently-visible product set, ranked by
 * count then name. Counts reflect the products passed in (already category/zone
 * filtered by the caller) so the sidebar shows honest "N products" hints.
 * Active tags are always included even if their count dropped to 0 under the
 * current filter, so a selected chip never vanishes.
 */
export function buildTagFacet(products: Product[], activeTags: string[]): FacetOption[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const active = new Set(activeTags);
  for (const t of active) if (!counts.has(t)) counts.set(t, 0);

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, active: active.has(value) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
