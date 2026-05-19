import Link from "next/link";
import { VendorCard } from "../components/VendorCard";
import { ProductCard } from "../components/ProductCard";
import { fetchFeaturedProducts } from "../lib/marketplace";
import { marketplace } from "../data/marketplace";

export const revalidate = 600;

export default async function HomePage() {
  const featured = await fetchFeaturedProducts();

  return (
    <main className="hub-home">
      <section className="hub-home__hero">
        <span className="eyebrow">— Gather at the Grove · Appalachian agroforestry village —</span>
        <h1>
          A village of small farms, small workshops, and the writing about why
          this still matters.
        </h1>
        <p className="hub-home__lead">
          Three independent Appalachian businesses on one West Virginia hillside. We
          share the land, the journal, and a longer view of what regional economies
          can be. We don&apos;t share a cart — every checkout is the maker&apos;s own.
        </p>
        <div className="hub-home__cta">
          <Link href="/marketplace" className="btn-primary">
            Browse the village
          </Link>
          <Link href="/journal" className="btn-secondary">
            Read the journal
          </Link>
        </div>
      </section>

      <section className="hub-home__vendors">
        <header>
          <span className="eyebrow">— The three shops —</span>
          <h2>Who&apos;s in the village.</h2>
        </header>
        <div className="hub-home__vendor-grid">
          {marketplace.vendors.map((v) => (
            <VendorCard key={v.slug} vendor={v} />
          ))}
        </div>
      </section>

      <section className="hub-home__featured">
        <header>
          <span className="eyebrow">— This week from the village —</span>
          <h2>Featured products.</h2>
          <Link href="/marketplace">See the full marketplace →</Link>
        </header>
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

      <section className="hub-home__manifesto">
        <span className="eyebrow">— The thesis —</span>
        <blockquote>
          &ldquo;A village marketplace doesn&apos;t take a cut. It points you at each maker&apos;s
          own till, then gets out of the way. We&apos;re building the platform we wish
          had existed when we started.&rdquo;
        </blockquote>
        <Link href="/about">Read more →</Link>
      </section>
    </main>
  );
}
