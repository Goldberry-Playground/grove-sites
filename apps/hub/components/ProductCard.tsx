import Link from "next/link";
import type { HubProduct } from "../lib/marketplace";

type Props = {
  product: HubProduct;
  editorialNote?: string;
};

/**
 * Federated product card used on /marketplace, vendor profile, and journal embeds.
 * Vendor brandColor accents the bottom border so cards from different vendors are
 * visually distinguishable in a mixed grid.
 */
export function ProductCard({ product, editorialNote }: Props) {
  const { product: p, vendor } = product;
  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency ?? "USD",
  }).format(p.price);

  return (
    <Link
      href={`/marketplace/${vendor.slug}/${p.slug}`}
      className="product-card"
      style={{ borderBottomColor: vendor.brandColor }}
    >
      <div className="product-card__image">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${vendor.odoo.apiUrl}${p.imageUrl}`}
            alt={p.name}
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="product-card__body">
        <div className="product-card__vendor" style={{ color: vendor.brandColor }}>
          {vendor.name}
        </div>
        <h3 className="product-card__name">{p.name}</h3>
        {editorialNote ? (
          <p className="product-card__editorial">“{editorialNote}”</p>
        ) : null}
        <div className="product-card__price">{priceFormatted}</div>
      </div>
    </Link>
  );
}
