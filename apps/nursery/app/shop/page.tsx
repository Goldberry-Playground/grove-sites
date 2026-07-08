import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";
import { tenantConfig } from "../../tenant.config";
import { mockProducts } from "../../data/mock-products";
import { CategoryBar } from "../category-bar";
import { filterByCategory, findCategory } from "../../data/categories";

// Render on every request so the page reflects current Odoo state.
// (Build-time render can't reach Odoo when building inside Docker; ISR will
// be reintroduced once Odoo posts a revalidation webhook — Sprint 5.)
export const dynamic = "force-dynamic";

interface ShopPageProps {
  searchParams: Promise<{ cat?: string }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  // Next.js 15 — searchParams is a Promise in async server components.
  const { cat: catSlug } = await searchParams;

  // 1) Fetch products: Odoo first, mockProducts fallback. The filter runs
  //    against whichever source returned data — same logic for both, which
  //    is exactly the seam Odoo will plug into when product tags are exposed.
  // 2) Filter by category slug. The filter logic lives in data/categories.ts
  //    so the homepage's CategoryBar, the shop page filter, and any future
  //    consumer all share one source of truth for what "Apple" means.
  let allProducts: Product[] = [];
  let usingMockData = false;

  try {
    const result = await odoo.products.list({ limit: 40 });
    allProducts = result.products;
  } catch {
    // Odoo unreachable — fall back to seed data so the storefront is still
    // demoable. Remove this branch when Odoo is consistently up.
    allProducts = mockProducts;
    usingMockData = true;
  }

  if (allProducts.length === 0) {
    allProducts = mockProducts;
    usingMockData = true;
  }

  const products = filterByCategory(allProducts, catSlug);
  const activeCategory = findCategory(catSlug);

  return (
    <>
      <CategoryBar activeSlug={catSlug ?? null} />

      <section className="section">
        <div className="section-header">
          <h2>
            {activeCategory ? activeCategory.label : tenantConfig.copy.shopHeading}
          </h2>
          <span className="section-tag">
            {products.length} {products.length === 1 ? "variety" : "varieties"}
            {activeCategory && allProducts.length !== products.length
              ? ` · of ${allProducts.length} total`
              : ""}
          </span>
        </div>

        {activeCategory?.description && (
          <p className="section-lede">{activeCategory.description}</p>
        )}

        {usingMockData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 mb-8 text-amber-800 text-xs font-mono uppercase tracking-wider">
            Demo catalog · These products are placeholders until the Odoo
            backend is live.
          </div>
        )}

        {products.length === 0 ? (
          // Empty state — happens when a category has no matching products.
          // For QA visibility this should never show in normal mock-data flow
          // since each category has at least one product, but it's important
          // for the Odoo-live case where new categories may be empty at first.
          <div className="shop-empty">
            <p>
              No products in <em>{activeCategory?.label ?? "this category"}</em>{" "}
              yet — check back soon, or{" "}
              <Link href="/shop" className="shop-empty__link">
                browse the full catalog
              </Link>
              .
            </p>
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
                  {product.imageUrl && (
                    <Image
                      src={resolveOdooImageUrl(product.imageUrl, odooBase)}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  )}
                  {product.featured && (
                    <span className="var-badge">Featured</span>
                  )}
                </div>
                <div className="var-info">
                  {product.categoryName && (
                    <span className="var-latin">{product.categoryName}</span>
                  )}
                  <h3 className="var-name">{product.name}</h3>
                  <div className="var-foot">
                    <span className="var-price">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="var-stock">
                      {product.available ? "In stock" : "Sold out"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
