import Link from "next/link";
import { ProductCard } from "../../components/ProductCard";
import {
  fetchFeaturedProducts,
  fetchVendorProducts,
  searchProducts,
} from "../../lib/marketplace";
import { marketplace } from "../../data/marketplace";

export const revalidate = 3600;

type SearchParams = { q?: string };

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  if (query) {
    const matches = await searchProducts(query);
    return (
      <main className="marketplace">
        <header className="marketplace__head">
          <h1>Search results</h1>
          <p>{matches.length} product{matches.length === 1 ? "" : "s"} matching “{query}”.</p>
          <Link href="/marketplace">← Back to the marketplace</Link>
        </header>
        <section className="marketplace__grid">
          {matches.map((m) => (
            <ProductCard key={`${m.vendor.slug}-${m.product.slug}`} product={m} />
          ))}
        </section>
      </main>
    );
  }

  const featured = await fetchFeaturedProducts();
  const byVendor = await Promise.all(
    marketplace.vendors.map(async (v) => ({
      vendor: v,
      products: await fetchVendorProducts(v.slug),
    })),
  );

  return (
    <main className="marketplace">
      <header className="marketplace__head">
        <span className="eyebrow">— The Marketplace · This week from the village —</span>
        <h1>What the grove is making.</h1>
        <p>
          Federated catalog from three Appalachian agroforestry businesses. Click any
          product to read about it, then buy at the maker's own shop. The hub never
          touches the transaction.
        </p>
        <form className="marketplace__search" method="GET" action="/marketplace">
          <input
            type="search"
            name="q"
            placeholder="Search the village…"
            aria-label="Search products"
          />
          <button type="submit">Search</button>
        </form>
      </header>

      <section className="marketplace__featured">
        <h2>Featured this week</h2>
        <div className="marketplace__grid">
          {featured.map((f) => (
            <ProductCard
              key={`${f.vendor.slug}-${f.product.slug}`}
              product={{ product: f.product, vendor: f.vendor }}
              editorialNote={f.editorialNote}
            />
          ))}
        </div>
      </section>

      {byVendor.map(({ vendor, products }) =>
        vendor.comingSoon ? (
          <section
            key={vendor.slug}
            className="marketplace__vendor-section marketplace__vendor-section--soon"
            style={{ borderTopColor: vendor.brandColor }}
          >
            <header className="marketplace__vendor-head">
              <h2 style={{ color: vendor.brandColor }}>{vendor.name}</h2>
              <Link
                href={`/marketplace/vendor/${vendor.slug}`}
                style={{ color: vendor.brandColor }}
              >
                Meet the maker →
              </Link>
            </header>
            <p className="marketplace__coming-soon">{vendor.comingSoon}</p>
          </section>
        ) : (
          <section
            key={vendor.slug}
            className="marketplace__vendor-section"
            style={{ borderTopColor: vendor.brandColor }}
          >
            <header className="marketplace__vendor-head">
              <h2 style={{ color: vendor.brandColor }}>{vendor.name}</h2>
              <Link
                href={`/marketplace/vendor/${vendor.slug}`}
                style={{ color: vendor.brandColor }}
              >
                See all {products.length} from {vendor.name} →
              </Link>
            </header>
            <div className="marketplace__grid">
              {products.slice(0, 4).map((p) => (
                <ProductCard key={p.product.slug} product={p} />
              ))}
            </div>
          </section>
        ),
      )}
    </main>
  );
}
