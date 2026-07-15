import Link from "next/link";
import { ProductCard } from "../../components/ProductCard";
import {
  fetchFeaturedProducts,
  fetchVendorCatalog,
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
      catalog: await fetchVendorCatalog(v.slug),
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

      {/* No resolvable picks → no section. A "Featured this week" heading over
          an empty grid reads as a broken page; omitting it reads as a week
          without picks. Unresolved refs are warned server-side (GOL-400). */}
      {featured.length > 0 && (
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
      )}

      {byVendor.map(({ vendor, catalog }) => (
        <section
          key={vendor.slug}
          className={
            catalog.state === "ok"
              ? "marketplace__vendor-section"
              : "marketplace__vendor-section marketplace__vendor-section--soon"
          }
          style={{
            borderTopColor: vendor.brandColor,
            ["--vendor-color" as string]: vendor.brandColor,
          }}
        >
          <header className="marketplace__vendor-head">
            <h2 style={{ color: vendor.brandColor }}>{vendor.name}</h2>
            {/* "See all N" only when there is an N worth clicking. Every other
                state sends the reader to the maker's story instead of a grid
                that would be empty when they arrive. */}
            <Link
              href={`/marketplace/vendor/${vendor.slug}`}
              style={{ color: vendor.brandColor }}
            >
              {catalog.state === "ok"
                ? `See all ${catalog.products.length} from ${vendor.name} →`
                : "Meet the maker →"}
            </Link>
          </header>

          {catalog.state === "ok" ? (
            <div className="marketplace__grid">
              {catalog.products.slice(0, 4).map((p) => (
                <ProductCard key={p.product.slug} product={p} />
              ))}
            </div>
          ) : catalog.state === "coming-soon" ? (
            <p className="marketplace__coming-soon">{catalog.message}</p>
          ) : catalog.state === "empty" ? (
            // Reachable, genuinely nothing listed. States the fact without
            // promising a launch — only an explicit `comingSoon` may do that.
            <p className="marketplace__vendor-note">
              {vendor.name} hasn't listed anything in the marketplace yet.
            </p>
          ) : (
            // Odoo did not answer. Never dressed up as "no products".
            <p className="marketplace__vendor-note">
              We couldn't load {vendor.name}'s catalog just now. It should be
              back shortly — or visit{" "}
              <a href={vendor.homepageUrl}>{vendor.name}</a> directly.
            </p>
          )}
        </section>
      ))}
    </main>
  );
}
