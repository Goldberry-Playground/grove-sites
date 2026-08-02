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
  /** Free-text catalog search (`?q=`) — matched client-side against product
   *  name + category name. `null` when absent/blank so it never narrows. */
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
  const rawQ = (firstString(sp.q) ?? "").trim();
  return {
    cat: firstString(sp.cat),
    zone: zone !== null && ZONE_OPTIONS.includes(zone as (typeof ZONE_OPTIONS)[number]) ? zone : null,
    tags: stringList(sp.tag),
    layer:
      rawLayer !== null && (LAYER_OPTIONS as readonly string[]).includes(rawLayer) ? rawLayer : null,
    sun: rawSun !== null && (SUN_OPTIONS as readonly string[]).includes(rawSun) ? rawSun : null,
    q: rawQ.length > 0 ? rawQ : null,
  };
}

/** AND-filter a product list by selected usage tags. Empty selection → no-op. */
export function applyTagFilter(products: Product[], tags: string[]): Product[] {
  if (tags.length === 0) return products;
  return products.filter((p) => {
    const owned = new Set(p.tags ?? []);
    return tags.every((t) => owned.has(t));
  });
}

/**
 * Free-text catalog search (GOL-1111). Case- and accent-insensitive substring
 * match against the shopper-visible strings on each product — its name and its
 * category name — so "fig", "apple", or "nut tree" all narrow the grid. Blank
 * / null query is a no-op (returns the list unchanged), so an empty `?q=` never
 * hides the catalog. List items carry no descriptions, so name + category is the
 * honest match surface; the query is always AND-combined with the active facets
 * by the caller (search ∩ category ∩ zone ∩ tags).
 */
export function applySearchFilter(products: Product[], q: string | null): Product[] {
  const needle = normalizeText(q ?? "");
  if (needle.length === 0) return products;
  return products.filter((p) => {
    const haystack = normalizeText(`${p.name ?? ""} ${p.categoryName ?? ""}`);
    return haystack.includes(needle);
  });
}

/** Lowercase + strip diacritics so "Aronia" matches "aronia" and accented Latin
 *  names match their unaccented typing. */
function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Build a `/shop` href that MERGES a facet patch onto the current selection
 * (GOL-1111 filter-param merge). Category-bar pills and any server-built link
 * use this so navigating one axis (e.g. picking a category) preserves the
 * others (zone / tag / layer / sun / q) instead of resetting the query string.
 * A patch value of `null` clears that axis; an omitted key leaves it untouched.
 * Keys are emitted in a stable order so hrefs are deterministic (SSR-safe).
 */
export function shopHref(
  current: FacetParams,
  patch: Partial<{
    cat: string | null;
    zone: number | null;
    tags: string[];
    layer: string | null;
    sun: string | null;
    q: string | null;
  }> = {},
): string {
  const merged: FacetParams = { ...current, ...patch };
  const sp = new URLSearchParams();
  if (merged.cat) sp.set("cat", merged.cat);
  if (merged.zone !== null) sp.set("zone", String(merged.zone));
  for (const t of merged.tags) sp.append("tag", t);
  if (merged.layer) sp.set("layer", merged.layer);
  if (merged.sun) sp.set("sun", merged.sun);
  if (merged.q) sp.set("q", merged.q);
  const qs = sp.toString();
  return qs ? `/shop?${qs}` : "/shop";
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
