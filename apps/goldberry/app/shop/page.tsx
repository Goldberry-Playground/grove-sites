import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";
import {
  mockProducts,
  isDataUri,
  SHOP_CATEGORIES,
} from "../../data/mock-products";

// Render on every request so the page reflects current Odoo state.
// (Build-time render can't reach Odoo when building inside Docker; ISR will
// be reintroduced once Odoo posts a revalidation webhook — Sprint 5.)
export const dynamic = "force-dynamic";

/** Pick the products that belong to the selected category slug. The mock
 *  catalog uses categoryId; SHOP_CATEGORIES is the list-page filter source
 *  of truth. */
function filterByCategory(products: Product[], catSlug: string): Product[] {
  if (!catSlug || catSlug === "all") return products;
  const cat = SHOP_CATEGORIES.find((c) => c.id === catSlug);
  if (!cat || !("categoryId" in cat)) return products;
  return products.filter((p) => p.categoryId === cat.categoryId);
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  const params = await searchParams;
  const activeCat = (params.cat ?? "all").toLowerCase();

  let products: Product[] = [];
  let usingMockData = false;

  try {
    const result = await odoo.products.list({ limit: 40 });
    products = result.products;
  } catch {
    // Odoo unreachable — fall back to seed data so the storefront is still
    // demoable. Remove this branch when Odoo is consistently up.
    products = mockProducts;
    usingMockData = true;
  }

  if (products.length === 0) {
    products = mockProducts;
    usingMockData = true;
  }

  const visible = filterByCategory(products, activeCat);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {usingMockData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-amber-800 text-xs font-mono uppercase tracking-wider">
          Demo catalog · These products are placeholders until the Odoo backend is live.
        </div>
      )}

      {visible.length === 0 ? (
        <p className="shop-empty">
          No products in this category just yet — check back as the season
          turns.
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {visible.map((product) => {
            const src = resolveOdooImageUrl(product.imageUrl, odooBase);
            const dataUri = isDataUri(src);
            return (
              <Link
                key={product.id}
                href={`/shop/${product.id}`}
                className={`rounded-lg border border-primary/10 p-4 hover:border-primary/30 transition-colors block ${!product.available ? "opacity-75" : ""}`}
              >
                <div className="relative h-48 sm:h-56 bg-secondary/20 rounded mb-4 overflow-hidden">
                  {src && !dataUri && (
                    <Image
                      src={src}
                      alt={product.name}
                      fill
                      className={`object-cover ${!product.available ? "saturate-50" : ""}`}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  )}
                  {src && dataUri && (
                    // Inline SVG data URI — bypass next/image to avoid the
                    // remotePatterns / optimizer round-trip.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={product.name}
                      className={`absolute inset-0 w-full h-full object-cover ${!product.available ? "saturate-50" : ""}`}
                    />
                  )}
                  {!product.available && (
                    <span className="coming-soon">Coming Soon</span>
                  )}
                </div>
                {product.categoryName && (
                  <p className="product-cat">{product.categoryName}</p>
                )}
                <h2 className="shop-card__name">{product.name}</h2>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-primary font-bold">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.featured && (
                    <span className="text-[10px] sm:text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                      Featured
                    </span>
                  )}
                </div>
                {product.sku && (
                  <p className="text-xs text-foreground/40 mt-1">
                    SKU: {product.sku}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
