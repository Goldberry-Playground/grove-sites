import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { ProductImage } from "../product-image";
import { resolveOdooImageUrl, withOdooImageSize } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";
import { tenantConfig } from "../../tenant.config";
import { mockProducts } from "../../data/mock-products";
import { CategoryBar } from "../category-bar";
import { filterByCategory, findCategory } from "../../data/categories";
import { parseFacetParams, applyTagFilter } from "../../lib/facets";
import { plantCountLabel, varietyCountLabel } from "../../lib/catalog-labels";
import { FacetSidebar } from "./facet-sidebar";

// Deploy retrigger (GOL-768): agent auto-merges to main now re-fire docker.yml
// via auto-approve.yml's workflow_dispatch, so this touch rolls the pending
// GOL-761 image_1024 shop-grid fix live on nursery.qa. Safe to remove later.
// Render on every request so the page reflects current Odoo state and the
// live facet selection. (Build-time render can't reach Odoo when building
// inside Docker; ISR returns once Odoo posts a revalidation webhook.)
export const dynamic = "force-dynamic";

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  const sp = await searchParams;
  const { cat, zone, tags, layer, sun } = parseFacetParams(sp);

  // 1) Fetch products. The `zone`, `layer`, and `sun` facets are applied
  //    SERVER-SIDE via the catalog API (list items carry no facts, so they
  //    can't be filtered client-side). Category + tag facets are applied
  //    client-side against the returned set.
  let base: Product[] = [];
  let usingMockData = false;
  try {
    const result = await odoo.products.list({
      limit: 40,
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

  // 2) Apply category + tag facets. Displayed = zone ∩ category ∩ tags.
  const byCategory = filterByCategory(base, cat);
  const products = applyTagFilter(byCategory, tags);
  const activeCategory = findCategory(cat);

  // 3) Facet option models. The plant-type axis is the canonical top CategoryBar
  //    (GOL-682 #2 — the left-rail "Type" list duplicated it, so it was dropped);
  //    `typeContext` still feeds the bar's cross-faceted counts. The tag counts
  //    respect the current category/zone context so each tag stays togglable.
  const typeContext = applyTagFilter(base, tags);

  return (
    <>
      <CategoryBar activeSlug={cat} products={typeContext} />

      <section className="section">
        <div className="section-header">
          <h2>{activeCategory ? activeCategory.label : tenantConfig.copy.shopHeading}</h2>
          <span className="section-tag">
            {plantCountLabel(products.length)}
            {base.length !== products.length ? ` · of ${base.length} total` : ""}
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
                {activeCategory &&
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
                {products.map((product, i) => (
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
          </div>
        </div>
      </section>
    </>
  );
}
