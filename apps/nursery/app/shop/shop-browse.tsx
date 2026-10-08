import Link from "next/link";
import type { CatalogNav, CatalogNavNode, Product } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";
import { tenantConfig } from "../../tenant.config";
import { mockProducts } from "../../data/mock-products";
import { CategoryBar } from "../category-bar";
import { filterByCategory, findCategory } from "../../data/categories";
import {
  parseFacetParams,
  applyTagFilter,
  applySearchFilter,
  shopHref,
} from "../../lib/facets";
import { plantCountLabel } from "../../lib/catalog-labels";
import { departmentHref, ORCHARD_SLUG } from "../../lib/departments";
import { dealBadgeLabel, anyOnOffer, filterOnOffer } from "../../lib/deals";
import { groupSearchResults, countSearchHits } from "../../lib/shop-search";
import { FacetSidebar } from "./facet-sidebar";
import { CatalogSearch } from "./catalog-search";
import { ProductGrid } from "./product-grid";
import { SearchResults } from "./search-results";

// Grid card cap (GOL-1111): a browse grid dumps cognitive load past ~two dozen
// cards (Miller's Law), and the old hard `limit: 40` silently dropped anything
// beyond it with no signal. Show a capped first page and reveal the rest behind
// an explicit "Show all" link (`?all=1`) so nothing is hidden without saying so.
const GRID_CAP = 24;

export interface ShopBrowseProps {
  /** The department being browsed. Null falls back to orchard behaviour. */
  dept: CatalogNavNode | null;
  /** The whole tree — grouped search spans every department, not just this one. */
  nav: CatalogNav;
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * The live-department browse body (GOL-2745).
 *
 * Extracted from `shop/page.tsx` so `/shop` (Orchard) and any future live
 * `/shop/<dept>` render the SAME grid, pills and facets rather than growing a
 * second near-identical page. Flipping `grove_dept_status` to `live` in Odoo is
 * then genuinely a data change: the department page starts rendering this
 * instead of the teaser, with no storefront release.
 *
 * Two behaviours are new here, both from the spec:
 *  • a search runs across EVERY department + Guilds and renders grouped, so a
 *    coming-soon family can answer a query it has no products for;
 *  • the facet sidebar is limited to the department's own `grove_facets`, so
 *    orchard filters (layer, sun) never land on stock they don't describe.
 */
export async function ShopBrowse({ dept, nav, searchParams: sp }: ShopBrowseProps) {
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  const facets = parseFacetParams(sp);
  const { cat, zone, tags, layer, sun, q, offer } = facets;
  const showAll = sp.all === "1";
  const deptSlug = dept?.slug ?? ORCHARD_SLUG;
  const basePath = departmentHref(deptSlug);

  // 1) Fetch products. `zone`, `layer` and `sun` are applied SERVER-SIDE via the
  //    catalog API (list items carry no facts, so they can't be filtered
  //    client-side). Category + tag facets are applied client-side.
  //
  //    A SEARCH deliberately drops the department scope: the spec's search runs
  //    across every live department plus Guilds, so narrowing the fetch to one
  //    department would make a cross-department search structurally impossible.
  const searching = q !== null;
  let base: Product[] = [];
  let usingMockData = false;
  try {
    const result = await odoo.products.list({
      // Fetch the whole catalog (small); the visible grid is capped client-side
      // with an explicit reveal, so this limit is a safety ceiling, not a silent
      // truncation the way the old `40` was.
      limit: 200,
      ...(zone !== null ? { zone } : {}),
      ...(layer !== null ? { layer } : {}),
      ...(sun !== null ? { sun } : {}),
      ...(!searching && deptSlug !== ORCHARD_SLUG ? { dept: deptSlug } : {}),
    });
    base = result.products;
  } catch {
    base = mockProducts;
    usingMockData = true;
  }
  // Only fall back to mock data on a genuinely empty catalog — an empty result
  // under an active server-side facet (zone/layer/sun) is a real "no matches",
  // not a dead backend, and must render the empty state instead of mocks.
  if (base.length === 0 && zone === null && layer === null && sun === null) {
    base = mockProducts;
    usingMockData = true;
  }

  // 2) Volume-discount badge text, resolved once for the whole page. The client
  //    swallows an unreachable/absent program to `[]`, so a missing program can
  //    never invent a discount.
  const dealLabel = dealBadgeLabel(await odoo.promotions.auto());

  // 3) Apply category + tag + search + offer facets.
  //    Displayed = zone ∩ category ∩ tags ∩ search ∩ offer.
  const byCategory = filterByCategory(base, cat);
  const byTags = applyTagFilter(byCategory, tags);
  const bySearch = applySearchFilter(byTags, q);
  const products = filterOnOffer(bySearch, offer);
  const activeCategory = findCategory(cat);

  // The "On offer" control only renders when something in view actually is
  // (spec decision 5) — or when the facet is already active, so a selected
  // filter can always be cleared rather than stranding the shopper.
  const offerAvailable = anyOnOffer(byTags) || offer;

  // 4) Grid card cap (GOL-1111).
  const isCapped = !showAll && products.length > GRID_CAP;
  const visible = isCapped ? products.slice(0, GRID_CAP) : products;
  const revealBase = shopHref(facets, {}, basePath);
  const revealHref = `${revealBase}${revealBase.includes("?") ? "&" : "?"}all=1`;

  // 5) Facet option models. The plant-type axis is the canonical top CategoryBar
  //    (GOL-682 #2); `typeContext` feeds the bar's cross-faceted counts.
  const typeContext = applySearchFilter(applyTagFilter(base, tags), q);

  // 6) Grouped cross-department search (spec § Search).
  const groups = searching ? groupSearchResults(products, nav, q) : [];
  const searchHits = countSearchHits(groups);

  const heading = searching
    ? "Search results"
    : activeCategory
      ? activeCategory.label
      : (dept?.name ?? tenantConfig.copy.shopHeading);

  return (
    <>
      {/* Category pills are the DEPARTMENT's fine axis, so they stand down for a
          cross-department search: they can only narrow the orchard, and leaving
          them up printed "All Catalog · 0" next to "1 match" for a query that
          hit a coming-soon family. A control that contradicts the result it sits
          above is worse than no control.

          Otherwise: pass the active facets so pills MERGE the selection (keep
          zone/tag/layer/sun/q) instead of resetting the query string (GOL-1111),
          and the department's own path so a pill stays in this department. */}
      {!searching && (
        <CategoryBar
          activeSlug={cat}
          basePath={basePath}
          products={typeContext}
          facets={facets}
        />
      )}

      <section className="section">
        <div className="section-header">
          <h2>{heading}</h2>
          <span className="section-tag">
            {searching
              ? searchHits === 1
                ? "1 match"
                : `${searchHits} matches`
              : plantCountLabel(products.length)}
            {!searching && isCapped ? ` · showing ${visible.length}` : ""}
            {!searching && !isCapped && base.length !== products.length
              ? ` · of ${base.length} total`
              : ""}
          </span>
        </div>

        {!searching && activeCategory?.description && (
          <p className="section-lede">{activeCategory.description}</p>
        )}
        {!searching && !activeCategory && dept?.teaser && (
          <p className="section-lede">{dept.teaser}</p>
        )}

        {usingMockData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 mb-8 text-amber-800 text-xs font-mono uppercase tracking-wider">
            Demo catalog · These products are placeholders until the Odoo backend is
            live. Zone filtering applies against live Odoo only.
          </div>
        )}

        <CatalogSearch initialQuery={q ?? ""} />

        {searching ? (
          // A cross-department search has no single department to filter inside,
          // so the sidebar stands down rather than offering controls that would
          // narrow only one of the groups.
          <SearchResults
            groups={groups}
            odooBase={odooBase}
            dealLabel={dealLabel}
            query={q}
          />
        ) : (
          <div className="flex flex-col md:flex-row gap-8">
            <FacetSidebar
              dept={dept}
              activeCat={cat}
              activeZone={zone}
              activeTags={tags}
              activeLayer={layer}
              activeSun={sun}
              activeOffer={offer}
              offerAvailable={offerAvailable}
            />

            <div className="flex-1">
              {products.length === 0 ? (
                <div className="shop-empty">
                  {offer ? (
                    <p>
                      Nothing is on offer under these filters right now.{" "}
                      <Link
                        href={shopHref(facets, { offer: false }, basePath)}
                        className="shop-empty__link"
                      >
                        drop the offer filter
                      </Link>
                      .
                    </p>
                  ) : activeCategory &&
                    (!tags || tags.length === 0) &&
                    zone === null &&
                    layer === null &&
                    sun === null ? (
                    // Coming-soon bucket (GOL-773): the category is the only
                    // active facet and carries no stock yet — say so plainly
                    // instead of "no match / clear filters".
                    <p>
                      {activeCategory.label} stock is on the way. Nothing ready to
                      ship just yet.{" "}
                      <Link href={basePath} className="shop-empty__link">
                        Browse the full catalog
                      </Link>
                      .
                    </p>
                  ) : (
                    <p>
                      No products match these filters.{" "}
                      <Link href={basePath} className="shop-empty__link">
                        clear filters
                      </Link>
                      .
                    </p>
                  )}
                </div>
              ) : (
                <ProductGrid
                  products={visible}
                  odooBase={odooBase}
                  dealLabel={dealLabel}
                />
              )}

              {isCapped && (
                // Explicit reveal (GOL-1111): never hide cards silently.
                <div className="shop-reveal">
                  <Link href={revealHref} className="shop-reveal__link" scroll={false}>
                    Show all {products.length} plants
                    <svg
                      aria-hidden="true"
                      className="shop-reveal__chevron"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </Link>
                  <span className="shop-reveal__hint">
                    Showing {visible.length} of {products.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
