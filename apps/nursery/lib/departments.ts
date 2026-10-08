import type { CatalogFacet, CatalogNav, CatalogNavNode, Product } from "@grove/odoo-client";
import { ORCHARD_SLUG, LEGACY_GUILD_CATEGORY_SLUGS } from "../data/nav";

/**
 * Pure department helpers (GOL-2745).
 *
 * Deliberately split from `lib/catalog-nav.ts`: that module imports the Odoo
 * client, which is `server-only`, and CLIENT components need these rules too —
 * the facet sidebar decides which controls to render from `showsFacet`, and
 * NotifyMe builds its waitlist tag from `waitlistInterest`. Importing them
 * through the fetching module dragged `server-only` into a client bundle and
 * 500'd every shop route. Keep this file free of any client/fetch import.
 */

export { ORCHARD_SLUG, GUILDS_SLUG, LEGACY_GUILD_CATEGORY_SLUGS } from "../data/nav";

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

/**
 * True when a product belongs to the Guilds collection — by the nav's own slug,
 * or by the pre-restructure category slug the backend still serves today.
 */
export function isGuildProduct(product: Product, guildsSlug: string): boolean {
  const slugs = (product.categories ?? []).map((c) => c.slug);
  return (
    slugs.includes(guildsSlug) ||
    slugs.some((s) => LEGACY_GUILD_CATEGORY_SLUGS.includes(s))
  );
}

/**
 * One-line purpose for a guild card, taken from the product's description.
 *
 * Guild copy lives in Odoo's description as a paragraph; the card wants its
 * first sentence. Deliberately TRUNCATES rather than paraphrases — the copy is
 * Josh's and Sora's, and a card is not the place to rewrite it. Returns null
 * when there's nothing to show, so the card omits the line instead of rendering
 * an empty one.
 */
export function guildPurpose(descriptionHtml: string | null | undefined): string | null {
  if (!descriptionHtml) return null;
  const text = descriptionHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return null;
  // First sentence, on a full stop followed by a space + capital — so "$45 for
  // the bundle." splits but "St. Lawrence" and a trailing price don't.
  const match = text.match(/^(.+?[.!?])(?:\s+[A-Z$])/);
  const sentence = (match ? match[1] : text).trim();
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
}

/** Newsletter interest tag for a department waitlist (spec § Notify-me). */
export function waitlistInterest(slug: string): string {
  return `waitlist:${slug}`;
}
