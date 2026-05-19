import { notFound } from "next/navigation";
import Link from "next/link";
import { BuyAtVendorForm } from "../../../../components/BuyAtVendorForm";
import { fetchProductByVendorSlug } from "../../../../lib/marketplace";

export const revalidate = 300;

type Params = { vendor: string; productSlug: string };

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
            <p className="product-detail__desc">{product.description}</p>
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
