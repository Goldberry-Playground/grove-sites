import type { Metadata } from "next";
import { getCatalogNav } from "../../lib/catalog-nav";
import { findDepartment, ORCHARD_SLUG } from "../../lib/departments";
import { DepartmentNav } from "../department-nav";
import { ShopBrowse } from "./shop-browse";
import { tenantConfig } from "../../tenant.config";

// The page renders dynamically (per-request) because it awaits `searchParams`
// for the live facet selection — that alone opts it out of build-time static
// generation, so nothing tries to reach Odoo while building inside Docker.
//
// We deliberately do NOT set `force-dynamic` (GOL-1319): that would flip the
// route to `fetchCache: 'force-no-store'` and force a fresh full-catalog Odoo
// round-trip on every search submit, category-pill click, and `?all=1` reveal —
// hammering the single 4GB droplet — because `odoo.products.list()` carries its
// own 60s `next.revalidate`. Without `force-dynamic`, that revalidate is honored:
// the browse fetch is served from the shared Data Cache and refreshed at most
// once a minute (per facet URL), and the publish webhook's
// `revalidatePath('/shop')` still flushes it immediately on a new/edited product.

// Catalog index metadata (GOL-2878 Phase 1).
//
// Title reuses the heading already on the page (`tenantConfig.copy.shopHeading`)
// rather than inventing a keyword-tuned one — a commercial title here is a
// brand-voice call for CMO, flagged on the ticket. The canonical is the bare
// `/shop`: the facet params (`?cat=`, `?q=`, `?tags=`, `?all=1`) multiply into
// effectively unbounded URLs that are all the same catalog, and every one of
// them was indexable as a separate page before this.
export const metadata: Metadata = {
  title: tenantConfig.copy.shopHeading,
  alternates: { canonical: "/shop" },
};

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/shop` — the **Orchard & food forest** department (GOL-2745).
 *
 * Deliberately NOT `/shop/orchard`: `/shop` stays the orchard so every existing
 * link, every indexed `?cat=` URL and the browsing people already do keep
 * working unchanged. The department tabs simply appear above them.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const sp = await searchParams;
  const { nav } = await getCatalogNav();
  const dept = findDepartment(nav, ORCHARD_SLUG);

  return (
    <>
      <DepartmentNav nav={nav} activeSlug={ORCHARD_SLUG} />
      <ShopBrowse dept={dept} nav={nav} searchParams={sp} />
    </>
  );
}
