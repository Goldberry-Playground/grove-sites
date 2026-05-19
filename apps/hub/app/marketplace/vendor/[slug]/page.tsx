import { notFound } from "next/navigation";
import { ProductCard } from "../../../../components/ProductCard";
import { fetchVendorProducts } from "../../../../lib/marketplace";
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

  const products = await fetchVendorProducts(slug);

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
        {products.length === 0 ? (
          <p className="vendor-profile__empty">
            {vendor.name}'s catalog is currently unreachable. Visit them directly →{" "}
            <a href={vendor.homepageUrl}>{vendor.homepageUrl}</a>
          </p>
        ) : (
          <div className="marketplace__grid">
            {products.map((p) => (
              <ProductCard key={p.product.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
