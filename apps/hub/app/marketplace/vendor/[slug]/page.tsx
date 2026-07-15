import { notFound } from "next/navigation";
import { ProductCard } from "../../../../components/ProductCard";
import { fetchVendorCatalog } from "../../../../lib/marketplace";
import { findVendor } from "../../../../data/marketplace";

export const revalidate = 600;

type Params = { slug: string };

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const vendor = findVendor(slug);
  if (!vendor) notFound();

  const catalog = await fetchVendorCatalog(slug);

  // Render vendor.story as paragraphs (light markdown — one blank line = paragraph break).
  const paragraphs = vendor.story.split(/\n\s*\n/).filter(Boolean);

  return (
    <main className="vendor-profile" style={{ ["--vendor-color" as string]: vendor.brandColor }}>
      <header className="vendor-profile__head" style={{ borderTopColor: vendor.brandColor }}>
        <span className="eyebrow" style={{ color: vendor.brandColor }}>
          The Village · Vendor Profile
        </span>
        <h1 style={{ color: vendor.brandColor }}>{vendor.name}</h1>
        <p className="vendor-profile__tagline">{vendor.tagline}</p>
        <a
          href={vendor.homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="vendor-profile__site-link"
        >
          Visit {vendor.name} →
        </a>
      </header>

      <section className="vendor-profile__story">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <section className="vendor-profile__catalog">
        <h2>What {vendor.name} is making</h2>
        {catalog.state === "coming-soon" ? (
          <p className="vendor-profile__coming-soon">{catalog.message}</p>
        ) : catalog.state === "empty" ? (
          <p className="vendor-profile__empty">
            {vendor.name} hasn't listed anything in the marketplace yet. Their
            own shop is the best place to look →{" "}
            <a href={vendor.homepageUrl}>{vendor.homepageUrl}</a>
          </p>
        ) : catalog.state === "unreachable" ? (
          <p className="vendor-profile__empty">
            We couldn't load {vendor.name}'s catalog just now. Visit them
            directly →{" "}
            <a href={vendor.homepageUrl}>{vendor.homepageUrl}</a>
          </p>
        ) : (
          <div className="marketplace__grid">
            {catalog.products.map((p) => (
              <ProductCard key={p.product.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
