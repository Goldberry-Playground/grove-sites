import Image from "next/image";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../lib/clients";
import { mockProducts } from "../data/mock-products";
import {
  selectLeadSellers,
  displayPrice,
  type LeadSeller,
} from "../data/featured";

/**
 * Data-driven lead-seller row for the homepage (GOL-659).
 *
 * Fetches the live catalog (Odoo first, mock fallback), picks the curated
 * lead sellers via data/featured.ts, and renders each as a card that links to
 * its real product page (`/shop/<id>`) — the previous hardcoded `/shop/<slug>`
 * links all 404'd because the detail route keys on numeric id. Every card,
 * and the "browse all" footer, resolves to a real destination.
 */

/**
 * Fetch the catalog for the homepage — Odoo first, mock fallback. Shared by the
 * page (hero "varieties in catalog" stat + total) and the lead-seller row, so
 * both read one consistent count rather than fetching (and disagreeing).
 */
export async function fetchCatalog(): Promise<{ products: Product[]; total: number }> {
  try {
    const result = await odoo.products.list({ limit: 200 });
    if (result.products.length > 0) {
      return { products: result.products, total: result.count ?? result.products.length };
    }
  } catch {
    // Odoo unreachable — fall through to seed data so the homepage still renders.
  }
  return { products: mockProducts, total: mockProducts.length };
}

/** "from $12.00" for multi-variant products, "$42.00" for single-price ones. */
function priceLabel(p: Product): string {
  return typeof p.priceMin === "number"
    ? `from $${p.priceMin.toFixed(2)}`
    : `$${displayPrice(p).toFixed(2)}`;
}

interface FeaturedLeadSellersProps {
  products: Product[];
  total: number;
}

export function FeaturedLeadSellers({ products, total }: FeaturedLeadSellersProps) {
  const featured = selectLeadSellers(products);
  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";

  return (
    <section className="section" id="lead-sellers" aria-labelledby="lead-sellers-heading">
      <div className="section-header">
        <h2 id="lead-sellers-heading">
          This season&apos;s <em>lead sellers.</em>
        </h2>
        <span className="section-tag">— Our most-planted, right now</span>
      </div>

      {featured.length === 0 ? (
        // Empty state — the catalog fetch returned nothing selectable. Honest
        // "we're replanting" beats a blank grid, and still routes somewhere real.
        <div className="shop-empty">
          <p>
            Our featured list is being <em>replanted</em>.{" "}
            <Link href="/shop" className="shop-empty__link">
              Browse the full catalog
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="var-grid">
          {featured.map((p: LeadSeller, i) => (
            <Link
              key={p.id}
              href={`/shop/${p.id}`}
              className="var-card"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="var-img">
                {p.onSale ? (
                  // Color-independent on-sale flag: the word "On sale" + a
                  // CSS-drawn down-triangle (::before, no font dependency) + a
                  // struck compare-at price below — three non-colour signals, so
                  // the state survives grayscale and deuteranopia / protanopia /
                  // tritanopia (verified in the GOL-659 grayscale render).
                  <span className="var-badge sale">On sale</span>
                ) : (
                  p.featured && <span className="var-badge">Featured</span>
                )}
                {p.imageUrl && (
                  <Image
                    src={resolveOdooImageUrl(p.imageUrl, odooBase)}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                )}
              </div>
              <div className="var-info">
                {p.categoryName && <span className="var-latin">{p.categoryName}</span>}
                <h3 className="var-name">{p.name}</h3>
                {typeof p.variantCount === "number" && p.variantCount > 1 && (
                  <span className="var-latin">{p.variantCount} varieties</span>
                )}
                <div className="var-foot">
                  <span className="var-price">
                    {p.onSale && p.compareAtPrice != null ? (
                      <>
                        <s className="var-price-was">${p.compareAtPrice.toFixed(2)}</s>{" "}
                        <span className="var-price-now">{priceLabel(p)}</span>
                        <span className="sr-only">
                          {" "}
                          on sale, was ${p.compareAtPrice.toFixed(2)}, now {priceLabel(p)}
                        </span>
                      </>
                    ) : (
                      priceLabel(p)
                    )}
                  </span>
                  <span
                    className={`var-stock ${p.available ? "var-stock--in" : "var-stock--out"}`}
                  >
                    {p.available ? "In stock" : "Sold out"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "3rem" }}>
        <Link href="/shop" className="btn btn-forest">
          Browse all {total} varieties &rarr;
        </Link>
      </div>
    </section>
  );
}
