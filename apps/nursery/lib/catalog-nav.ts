import type {
  CatalogFacet,
  CatalogNav,
  CatalogNavNode,
  Product,
} from "@grove/odoo-client";
import { odoo } from "./clients";
import { mockCatalogNav, ORCHARD_SLUG } from "../data/nav";

/**
 * Catalog-nav seam for the shop surfaces (GOL-2745).
 *
 * Odoo is the source of truth for the department tree; this module is the one
 * place the storefront reads it, with the same Odoo-first / mock-fallback
 * posture `/shop` already uses for products. Every shop page calls
 * `getCatalogNav()`, so the tab row, the department pages, the Guilds link and
 * grouped search all agree on one tree per request.
 */

export { ORCHARD_SLUG, GUILDS_SLUG } from "../data/nav";

export interface CatalogNavResult {
  nav: CatalogNav;
  /** True when the tree came from `data/nav.ts`, not Odoo. The shop pages
   *  already surface a "Demo catalog" notice on the mock product path; this
   *  lets a caller reason about the nav's provenance too. */
  usingMockNav: boolean;
}

/**
 * Fetch the department tree. Never throws: a backend that predates
 * `/catalog/nav` (every backend until Ada's grove_headless PR lands) and a
 * dead Odoo both fall back to the mock tree, so the storefront ships the
 * departments ahead of the data.
 */
export async function getCatalogNav(): Promise<CatalogNavResult> {
  try {
    const nav = await odoo.catalog.nav();
    // An empty tree is a backend that answered but has nothing filed yet —
    // rendering a nav with no tabs would hide /shop's own department, so fall
    // back rather than paint an empty bar.
    if (nav.departments.length > 0) return { nav, usingMockNav: false };
  } catch {
    // Route absent / Odoo unreachable — fall through to the mock tree.
  }
  return { nav: mockCatalogNav, usingMockNav: true };
}

/**
 * Departments that earn a tab. Per the spec: shown when `live` AND carrying at
 * least one published product, or when `coming_soon`. `hidden` never renders,
 * and a `live` department with an empty grid is suppressed rather than shipped
 * as a dead tab.
 *
 * The Orchard department is the one exception: it IS `/shop`, so it stays on
 * the bar even at a zero count — suppressing it would leave the shopper with
 * no way back to the catalog they're standing in.
 */
export function visibleDepartments(nav: CatalogNav): CatalogNavNode[] {
  return nav.departments.filter((d) => {
    if (d.slug === ORCHARD_SLUG) return d.status !== "hidden";
    if (d.status === "coming_soon") return true;
    return d.status === "live" && d.count > 0;
  });
}

/** Look up a department by slug among the ones that render. Returns null for an
 *  unknown or hidden slug, which the route turns into a 404. */
export function findDepartment(nav: CatalogNav, slug: string): CatalogNavNode | null {
  return visibleDepartments(nav).find((d) => d.slug === slug) ?? null;
}

/** `/shop/<slug>` for a department — Orchard lives at `/shop` itself, so its
 *  own tab must not link to `/shop/orchard` (which would 404). */
export function departmentHref(slug: string): string {
  return slug === ORCHARD_SLUG ? "/shop" : `/shop/${slug}`;
}

/** The department a product belongs to, falling back to Orchard on a backend
 *  that doesn't report one yet — today every published product IS orchard
 *  stock, and an "unknown" bucket in grouped search would be noise. */
export function departmentSlugOf(product: Product): string {
  return product.department?.slug ?? ORCHARD_SLUG;
}

/**
 * Whether a department shows a given facet. Departments that declare no facets
 * (a mock tree or a backend without `grove_facets`) fall back to showing the
 * orchard set, so the shop never silently loses its filters to a missing field.
 */
export function showsFacet(dept: CatalogNavNode | null, facet: CatalogFacet): boolean {
  if (!dept || dept.facets.length === 0) return DEFAULT_FACETS.includes(facet);
  return dept.facets.includes(facet);
}

/** Today's /shop facet set — the fallback when a department declares none. */
const DEFAULT_FACETS: CatalogFacet[] = ["zone", "layer", "sun", "uses", "on_offer"];

/**
 * Human-readable list of the filters a coming-soon department will offer, for
 * the teaser's "Filters when live: …" note. Keeps the promise concrete without
 * shipping controls that filter nothing.
 */
export const FACET_LABELS: Record<CatalogFacet, string> = {
  zone: "Hardiness zone",
  layer: "Food-forest layer",
  sun: "Sun",
  uses: "Uses",
  on_offer: "On offer",
  host_tree: "Host tree",
  fungus: "Fungus",
  shade_level: "Shade",
  years_to_harvest: "Years to harvest",
  form: "Form",
  species: "Species",
  ships: "Ships to",
};

/** "Hardiness zone, Host tree and Fungus" — an Oxford-comma list for the note. */
export function facetListLabel(facets: CatalogFacet[]): string {
  const names = facets.map((f) => FACET_LABELS[f]).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Newsletter interest tag for a department waitlist (spec § Notify-me). */
export function waitlistInterest(slug: string): string {
  return `waitlist:${slug}`;
}
