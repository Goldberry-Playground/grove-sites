import Link from "next/link";
import { GlyphIcon } from "@grove/ui-kit";
import { ProductCard } from "../../../components/ProductCard";
import {
  fetchFeaturedProducts,
  fetchVendorCatalog,
  searchProducts,
} from "../../../lib/marketplace";
import { marketplace } from "../../../data/marketplace";
import { firstPhotoIndex } from "../../../lib/odoo-image";

import { pageMetadata } from "../../../lib/site-metadata";

export const revalidate = 3600;

// One canonical for every `?q=` search view, so result pages don't index.
export const metadata = pageMetadata({
  path: "/marketplace",
  title: "The Marketplace",
  description:
    "What the grove is making: a federated catalog from three Appalachian agroforestry businesses on one West Virginia hillside.",
});

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
    const lcpIndex = firstPhotoIndex(matches);
    return (
      <main className="marketplace">
        <header className="marketplace__head">
          <h1>Search results</h1>
          <p>{matches.length} product{matches.length === 1 ? "" : "s"} matching “{query}”.</p>
          <Link href="/marketplace"><GlyphIcon name="arrow-left" /> Back to the marketplace</Link>
        </header>
        <section className="marketplace__grid">
          {matches.map((m, i) => (
            <ProductCard
              key={`${m.vendor.slug}-${m.product.slug}`}
              product={m}
              priority={i === lcpIndex}
            />
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

  // GOL-3477: exactly one card photo on the page is the LCP candidate — the
  // first card in render order that has a photo. With picks that is in the
  // featured row; otherwise it is in the first vendor row that has one. That
  // image loads eager + fetchpriority=high; every other card stays lazy.
  const featuredLcpIndex = firstPhotoIndex(featured);
  const vendorLcp =
    featuredLcpIndex >= 0
      ? null
      : byVendor
          .map(({ vendor, catalog }) => ({
            vendorSlug: vendor.slug,
            index: catalog.state === "ok" ? firstPhotoIndex(catalog.products.slice(0, 4)) : -1,
          }))
          .find((c) => c.index >= 0) ?? null;

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
            {featured.map((f, i) => (
              <ProductCard
                key={`${f.vendor.slug}-${f.product.slug}`}
                product={{ product: f.product, vendor: f.vendor }}
                editorialNote={f.editorialNote}
                priority={i === featuredLcpIndex}
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
                ? `See all ${catalog.products.length} from ${vendor.name}`
                : "Meet the maker"}{" "}
              <GlyphIcon name="arrow-right" />
            </Link>
          </header>

          {catalog.state === "ok" ? (
            <div className="marketplace__grid">
              {catalog.products.slice(0, 4).map((p, i) => (
                <ProductCard
                  key={p.product.slug}
                  product={p}
                  priority={vendor.slug === vendorLcp?.vendorSlug && i === vendorLcp.index}
                />
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
