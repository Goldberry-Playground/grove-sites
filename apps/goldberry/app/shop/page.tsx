import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl, withOdooImageSize } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";
import { isDataUri } from "../../lib/is-data-uri";
import { pageMetadata } from "../../lib/site-metadata";

// Render on every request so the page reflects current Odoo state.
// (Build-time render can't reach Odoo when building inside Docker; ISR will
// be reintroduced once Odoo posts a revalidation webhook — Sprint 5.)
export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  path: "/shop",
  title: "Farm Shop | Goldberry Grove Farm",
  description:
    "What we grow and make at Goldberry Grove, a regenerative agroforestry farm above Summersville, West Virginia.",
});

/**
 * The farm shop lists what Odoo publishes for the goldberry tenant and nothing
 * else (GOL-3315, gom printify spec Storefront §1/§2). There is no demo
 * catalog any more: when Odoo is unreachable or lists nothing, the page says so
 * instead of inventing products it cannot sell. `searchParams` stays in the
 * signature so the route type is unchanged; the old `?cat=` filter is gone with
 * the category tabs (three shirts need no tabs).
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  await searchParams;

  let products: Product[] = [];
  try {
    products = (await odoo.products.list({ limit: 40 })).products;
  } catch {
    // Odoo unreachable: the restocking state below is the only honest answer.
    products = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {products.length === 0 ? (
        <p className="shop-empty">The shop is restocking. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {products.map((product) => {
            // The list endpoint hands back image_128 thumbnails; cards render
            // far larger, so request the 1024 px rung and let next/image
            // downscale it crisply (same as the nursery grid, GOL-761).
            const src = resolveOdooImageUrl(withOdooImageSize(product.imageUrl, 1024), odooBase);
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
                {product.fulfillmentRoute === "printify" && (
                  <p className="shop-card__meta">Printed to order</p>
                )}
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
