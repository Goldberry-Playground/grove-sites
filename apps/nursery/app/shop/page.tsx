import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { ProductImage } from "../product-image";
import { resolveOdooImageUrl, withOdooImageSize } from "@grove/odoo-client";
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
import { plantCountLabel, varietyCountLabel } from "../../lib/catalog-labels";
import { FacetSidebar } from "./facet-sidebar";
import { CatalogSearch } from "./catalog-search";

// Grid card cap (GOL-1111): a browse grid dumps cognitive load past ~two dozen
// cards (Miller's Law), and the old hard `limit: 40` silently dropped anything
// beyond it with no signal. Show a capped first page and reveal the rest behind
// an explicit "Show all" link (`?all=1`) so nothing is hidden without saying so.
const GRID_CAP = 24;

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

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  const sp = await searchParams;
  const facets = parseFacetParams(sp);
  const { cat, zone, tags, layer, sun, q } = facets;
  const showAll = sp.all === "1";

  // 1) Fetch products. The `zone`, `layer`, and `sun` facets are applied
  //    SERVER-SIDE via the catalog API (list items carry no facts, so they
  //    can't be filtered client-side). Category + tag facets are applied
  //    client-side against the returned set.
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

  // 2) Apply category + tag + search facets.
  //    Displayed = zone ∩ category ∩ tags ∩ search.
  const byCategory = filterByCategory(base, cat);
  const byTags = applyTagFilter(byCategory, tags);
  const products = applySearchFilter(byTags, q);
  const activeCategory = findCategory(cat);

  // 3) Grid card cap (GOL-1111). Show the first GRID_CAP unless the shopper
  //    asked for all; a link toggles the rest without hiding the count.
  const isCapped = !showAll && products.length > GRID_CAP;
  const visible = isCapped ? products.slice(0, GRID_CAP) : products;
  const revealBase = shopHref(facets, {});
  const revealHref = `${revealBase}${revealBase.includes("?") ? "&" : "?"}all=1`;

  // 4) Facet option models. The plant-type axis is the canonical top CategoryBar
  //    (GOL-682 #2 — the left-rail "Type" list duplicated it, so it was dropped);
  //    `typeContext` still feeds the bar's cross-faceted counts. The tag + search
  //    context narrows those counts so each pill stays honest against the grid.
  const typeContext = applySearchFilter(applyTagFilter(base, tags), q);

  return (
    <>
      {/* Pass the active facets so category pills MERGE the selection (keep
          zone/tag/layer/sun/q) instead of resetting the query string (GOL-1111). */}
      <CategoryBar activeSlug={cat} products={typeContext} facets={facets} />

      <section className="section">
        <div className="section-header">
          <h2>{activeCategory ? activeCategory.label : tenantConfig.copy.shopHeading}</h2>
          <span className="section-tag">
            {plantCountLabel(products.length)}
            {isCapped ? ` · showing ${visible.length}` : ""}
            {!isCapped && base.length !== products.length ? ` · of ${base.length} total` : ""}
          </span>
        </div>

        {activeCategory?.description && (
          <p className="section-lede">{activeCategory.description}</p>
        )}

        {usingMockData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 mb-8 text-amber-800 text-xs font-mono uppercase tracking-wider">
            Demo catalog · These products are placeholders until the Odoo backend is
            live. Zone filtering applies against live Odoo only.
          </div>
        )}

        <CatalogSearch initialQuery={q ?? ""} />

        <div className="flex flex-col md:flex-row gap-8">
          <FacetSidebar
            activeCat={cat}
            activeZone={zone}
            activeTags={tags}
            activeLayer={layer}
            activeSun={sun}
          />

          <div className="flex-1">
            {products.length === 0 ? (
              <div className="shop-empty">
                {q ? (
                  // Search miss (GOL-1111): name the query back so it's clear what
                  // was searched, and offer a one-tap path back to the full grid
                  // (drop `q`, keep any other active facets via shopHref).
                  <p>
                    No plants match <em>“{q}”</em>
                    {activeCategory ? ` in ${activeCategory.label}` : ""} —{" "}
                    <Link
                      href={shopHref(facets, { q: null })}
                      className="shop-empty__link"
                    >
                      clear the search
                    </Link>
                    .
                  </p>
                ) : activeCategory &&
                  (!tags || tags.length === 0) &&
                  zone === null &&
                  layer === null &&
                  sun === null ? (
                  // Coming-soon bucket (GOL-773): the category is the only active
                  // facet and carries no stock yet (e.g. Native, Fruit & Nut
                  // Shrubs) — say so plainly instead of "no match / clear filters".
                  <p>
                    {activeCategory.label} stock is on the way — nothing ready to
                    ship just yet.{" "}
                    <Link href="/shop" className="shop-empty__link">
                      Browse the full catalog
                    </Link>
                    .
                  </p>
                ) : (
                  <p>
                    No products match these filters —{" "}
                    <Link href="/shop" className="shop-empty__link">
                      clear filters
                    </Link>
                    .
                  </p>
                )}
              </div>
            ) : (
              <div className="var-grid">
                {visible.map((product, i) => (
                  <Link
                    key={product.id}
                    href={`/shop/${product.id}`}
                    className="var-card"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="var-img">
                      <ProductImage
                        // The list endpoint hands back thumbnail (image_128)
                        // paths; cards render far larger, so request the 1024px
                        // rung and let next/image downscale it crisply (GOL-761
                        // — grid was blurry vs the sharp detail page).
                        // For source images ≤ 1024px (the current nursery photos) this rung is
                        // byte-identical to the detail page's image_1920, so cards match /shop/[id].
                        src={resolveOdooImageUrl(
                          withOdooImageSize(product.imageUrl, 1024),
                          odooBase,
                        )}
                        alt={product.name}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      {product.featured && <span className="var-badge">Featured</span>}
                    </div>
                    <div className="var-info">
                      {product.categoryName && (
                        <span className="var-latin">{product.categoryName}</span>
                      )}
                      <h3 className="var-name">{product.name}</h3>
                      <span className="var-latin">
                        {varietyCountLabel(product.cultivarCount ?? product.variantCount)}
                      </span>
                      <div className="var-foot">
                        <span className="var-price">
                          {typeof product.priceMin === "number"
                            ? `from $${product.priceMin.toFixed(2)}`
                            : `$${product.price.toFixed(2)}`}
                        </span>
                        {product.saleOk === false ? (
                          // Coming-soon placeholder: published (so it appears in
                          // the grid + ?cat= facets) but not for sale — the card
                          // links to a detail page whose buy box is locked
                          // (GOL-760). Don't claim "In stock".
                          <span className="var-stock var-stock--soon">
                            Coming soon
                          </span>
                        ) : (
                          <span
                            className={`var-stock ${product.available ? "var-stock--in" : "var-stock--out"}`}
                          >
                            {product.available ? "In stock" : "Sold out"}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {isCapped && (
              // Explicit reveal (GOL-1111): never hide cards silently. Says how
              // many remain and links to the full grid (?all=1) preserving the
              // active facets, so it's shareable and works without client JS.
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
      </section>
    </>
  );
}
