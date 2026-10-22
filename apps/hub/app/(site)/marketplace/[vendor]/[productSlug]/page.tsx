import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BuyAtVendorForm } from "../../../../../components/BuyAtVendorForm";
import { fetchProductByVendorSlug } from "../../../../../lib/marketplace";
import { sanitizePostHtml } from "../../../../../lib/sanitize";

export const revalidate = 300;

type Params = { vendor: string; productSlug: string };

// Self-canonical only (GOL-3585), so `?utm_…` copies collapse to one URL. Built
// from the route params alone — no extra Ghost/Odoo round-trip for metadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { vendor, productSlug } = await params;
  return { alternates: { canonical: `/marketplace/${vendor}/${productSlug}` } };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { vendor: vendorSlug, productSlug } = await params;
  const hub = await fetchProductByVendorSlug(vendorSlug, productSlug);
  if (!hub) notFound();

  const { product, vendor } = hub;
  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency ?? "USD",
  }).format(product.price);

  return (
    <main className="product-detail" style={{ ["--vendor-color" as string]: vendor.brandColor }}>
      <nav className="product-detail__crumbs">
        <Link href="/marketplace">Marketplace</Link>
        {" / "}
        <Link href={`/marketplace/vendor/${vendor.slug}`}>{vendor.name}</Link>
        {" / "}
        <span>{product.name}</span>
      </nav>

      <div className="product-detail__grid">
        <div className="product-detail__media">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${vendor.odoo.apiUrl}${product.imageUrl}`}
              alt={product.name}
            />
          ) : null}
        </div>

        <div className="product-detail__info">
          <div className="product-detail__vendor-tag" style={{ color: vendor.brandColor }}>
            From {vendor.name}
          </div>
          <h1>{product.name}</h1>
          <div className="product-detail__price">{priceFormatted}</div>

          {product.description ? (
            // HTML from Odoo (description_ecommerce or the escaped
            // description_sale fallback) — sanitize before injecting (GOL-2386).
            <div
              className="product-detail__desc"
              dangerouslySetInnerHTML={{ __html: sanitizePostHtml(product.description) }}
            />
          ) : null}

          <div className="product-detail__buy">
            <BuyAtVendorForm vendor={vendor} productId={product.id} />
            <p className="product-detail__buy-note">
              You'll go directly to {vendor.name}'s checkout. The hub doesn't process the order.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
