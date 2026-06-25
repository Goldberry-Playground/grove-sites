import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { odoo } from "../../lib/clients";
import { tenantConfig } from "../../tenant.config";
import { mockProducts } from "../../data/mock-products";

// Render on every request so the page reflects current Odoo state.
// (Build-time render can't reach Odoo when building inside Docker; ISR will
// be reintroduced once Odoo posts a revalidation webhook — Sprint 5.)
export const dynamic = "force-dynamic";

function resolveImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${process.env.ODOO_URL ?? "http://localhost:8069"}${imageUrl}`;
}

export default async function ShopPage() {
  let products: Product[] = [];
  let usingMockData = false;

  try {
    const result = await odoo.products.list({ limit: 40 });
    products = result.products;
  } catch {
    // Odoo unreachable — fall back to seed data so the storefront is
    // still demoable. Remove this branch when Odoo is consistently up.
    products = mockProducts;
    usingMockData = true;
  }

  if (products.length === 0) {
    products = mockProducts;
    usingMockData = true;
  }

  const categories = [
    ...new Set(
      products.map((p) => p.categoryName).filter(Boolean),
    ),
  ];

  return (
    <div className="timber-shop">
      {/* Lodge header */}
      <div className="timber-header">
        <span className="notch-tl" aria-hidden="true" />
        <span className="notch-br" aria-hidden="true" />
        <div className="cross-beam" aria-hidden="true" />
        <h1>
          The <em>Workshop</em>
        </h1>
        <p className="header-sub">
          Handcrafted in West Virginia · {products.length} pieces
        </p>
      </div>

      {/* Beam divider */}
      <div className="beam-divider" aria-hidden="true" />

      {/* Demo filler notice — hidden once Odoo backend is live */}
      {usingMockData && (
        <div className="timber-notice">
          Demo catalog · These products are placeholders until the
          Odoo backend is live.
        </div>
      )}

      {/* Category shelf */}
      {categories.length > 1 && (
        <div className="timber-shelf">
          <span className="timber-shelf-tag active">All</span>
          {categories.map((cat) => (
            <span key={cat} className="timber-shelf-tag">
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Timber product grid */}
      <div className="timber-grid">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="timber-card"
          >
            {/* Dovetail corners */}
            <span className="dovetail-tl" aria-hidden="true" />
            <span className="dovetail-br" aria-hidden="true" />

            {/* Iron nails */}
            <span className="nail nail-tl" aria-hidden="true" />
            <span className="nail nail-tr" aria-hidden="true" />
            <span className="nail nail-bl" aria-hidden="true" />
            <span className="nail nail-br" aria-hidden="true" />

            <div className="timber-card-img">
              {product.imageUrl && (
                <Image
                  src={resolveImageUrl(product.imageUrl)}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw,
                         (max-width: 1024px) 50vw, 33vw"
                />
              )}
              {product.featured && (
                <span className="timber-badge">Featured</span>
              )}
            </div>

            <div className="timber-card-body">
              {product.categoryName && (
                <span className="timber-card-category">
                  {product.categoryName}
                </span>
              )}
              <h2 className="timber-card-name">{product.name}</h2>
              {product.description && (
                <p className="timber-card-desc">
                  {product.description}
                </p>
              )}
              <span className="timber-card-action">
                View Details
              </span>
            </div>

            <div className="timber-card-foot">
              <span className="timber-card-price">
                ${product.price.toFixed(2)}
              </span>
              <span className="timber-card-sku">
                {product.available ? "Available" : "Sold out"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
