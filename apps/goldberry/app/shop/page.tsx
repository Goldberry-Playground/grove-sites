import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";

// Render on every request so the page reflects current Odoo state.
// (Build-time render can't reach Odoo when building inside Docker; ISR will
// be reintroduced once Odoo posts a revalidation webhook — Sprint 5.)
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  let products: Product[] = [];
  let error: string | null = null;

  try {
    const result = await odoo.products.list({ limit: 40 });
    products = result.products;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load products";
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-display font-bold text-primary mb-8">
        Farm Shop
      </h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-8 text-red-800 text-sm">
          Unable to load products. The shop will be available once the Odoo
          backend is configured.
        </div>
      )}

      {products.length === 0 && !error && (
        <p className="text-foreground/60 mb-8">
          No products available yet. Check back soon!
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="rounded-lg border border-primary/10 p-4 hover:border-primary/30 transition-colors block"
          >
            <div className="relative h-48 bg-secondary/20 rounded mb-4 overflow-hidden">
              {product.imageUrl && (
                <Image
                  src={`${process.env.ODOO_URL ?? "http://localhost:8069"}${product.imageUrl}`}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              )}
            </div>
            <h2 className="font-semibold text-foreground mb-1">
              {product.name}
            </h2>
            <div className="flex items-center justify-between">
              <span className="text-primary font-bold">
                ${product.price.toFixed(2)}
              </span>
              {product.featured && (
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
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
        ))}
      </div>
    </div>
  );
}
