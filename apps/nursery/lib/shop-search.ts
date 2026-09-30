import type {
  CatalogNav,
  CatalogNavNode,
  ComingSoonItem,
  Product,
} from "@grove/odoo-client";
import { GUILDS_SLUG, ORCHARD_SLUG } from "../data/nav";

/**
 * Cross-department search grouping (GOL-2745, spec § Storefront — Search).
 *
 * One search box on every shop page now searches EVERYTHING: the live
 * departments' products, the Guilds collection, and — this is the part that
 * needs no product records — the coming-soon families, matched against their
 * "What's coming" lists. Typing "ginseng" has to surface Forest farming even
 * though not one ginseng product exists yet; that is the whole reason the
 * teaser pages exist.
 *
 * Grouping (rather than one flat list) is what keeps that honest: a
 * coming-soon hit sits under a group labelled "Forest farming · Soon" and links
 * to that department's notify-me, so a shopper can never mistake a promise for
 * something they can buy today.
 *
 * Pure functions — no fetching — so the grouping rules are unit-testable.
 */

export type SearchGroupKind = "department" | "collection";

export interface SearchGroup {
  slug: string;
  name: string;
  kind: SearchGroupKind;
  /** `coming_soon` groups render coming items + a notify-me link, never cards. */
  status: CatalogNavNode["status"];
  /** Buyable matches, already filtered. Empty for a coming-soon group. */
  products: Product[];
  /** "What's coming" matches. Only ever populated for a coming-soon group. */
  comingItems: ComingSoonItem[];
}

/** Lowercase + strip diacritics, so "Aronia" matches "aronia" and an accented
 *  Latin name matches its unaccented typing. Mirrors `lib/facets`'s normalizer
 *  so the grouped search and the in-department filter agree on what "matches". */
function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function matches(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(needle);
}

/** True when a product is filed under the Guilds collection. */
function isGuild(product: Product, guildsSlug: string): boolean {
  return (product.categories ?? []).some((c) => c.slug === guildsSlug);
}

/**
 * Group a searched product set by department, with Guilds as its own group and
 * a group per coming-soon department whose "What's coming" list matches.
 *
 * `products` must already be the search-filtered set from the caller (the same
 * `applySearchFilter` the in-department grid uses), so the grid and these
 * groups can never disagree about what matched.
 *
 * Empty groups are dropped: a department with no hits is not a heading over
 * nothing.
 */
export function groupSearchResults(
  products: Product[],
  nav: CatalogNav,
  query: string,
): SearchGroup[] {
  const needle = normalizeText(query);
  const guildsSlug = nav.guilds?.slug ?? GUILDS_SLUG;
  const groups: SearchGroup[] = [];

  // Guild bundles are pulled out FIRST and appear only in the Guilds group.
  // A bundle also carries a department (its lead plant's), so without this a
  // single match would be counted twice and the totals would not add up.
  const guildHits: Product[] = [];
  const byDepartment = new Map<string, Product[]>();
  for (const product of products) {
    if (nav.guilds && isGuild(product, guildsSlug)) {
      guildHits.push(product);
      continue;
    }
    const slug = product.department?.slug ?? ORCHARD_SLUG;
    const bucket = byDepartment.get(slug);
    if (bucket) bucket.push(product);
    else byDepartment.set(slug, [product]);
  }

  for (const dept of nav.departments) {
    if (dept.status === "hidden") continue;

    if (dept.status === "coming_soon") {
      // No product records exist yet, so the match surface is the authored
      // "What's coming" list — plus the department's own name, so searching
      // "mycoforestry" finds the family itself.
      const nameHit = needle.length > 0 && matches(dept.name, needle);
      const comingItems = dept.comingList.filter(
        (item) =>
          nameHit ||
          matches(item.name, needle) ||
          (item.detail.length > 0 && matches(item.detail, needle)),
      );
      if (comingItems.length === 0) continue;
      groups.push({
        slug: dept.slug,
        name: dept.name,
        kind: "department",
        status: dept.status,
        products: [],
        comingItems,
      });
      continue;
    }

    const hits = byDepartment.get(dept.slug) ?? [];
    if (hits.length === 0) continue;
    groups.push({
      slug: dept.slug,
      name: dept.name,
      kind: "department",
      status: dept.status,
      products: hits,
      comingItems: [],
    });
  }

  // Guilds last — it's a cross-cutting collection, not a peer department, and
  // trailing it keeps the department order the shopper learned from the tabs.
  if (nav.guilds && guildHits.length > 0) {
    groups.push({
      slug: nav.guilds.slug,
      name: nav.guilds.name,
      kind: "collection",
      status: nav.guilds.status,
      products: guildHits,
      comingItems: [],
    });
  }

  return groups;
}

/** Total buyable + coming matches across the groups, for the result count. */
export function countSearchHits(groups: SearchGroup[]): number {
  return groups.reduce((n, g) => n + g.products.length + g.comingItems.length, 0);
}
