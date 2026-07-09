import { ProductCard as UiProductCard, type ProductCardData } from "@grove/ui-kit";
import type { HubProduct } from "../lib/marketplace";

type Props = {
  product: HubProduct;
  editorialNote?: string;
};

/**
 * Hub adapter: maps a HubProduct (Odoo-fetched, vendor-joined) onto the
 * presentational @grove/ui-kit ProductCard. Accent color (vendor.brandColor)
 * moves from an inline `borderBottomColor` style to the `--product-card-accent`
 * CSS-variable mechanism the ui-kit component expects. Link/Image are injected
 * via GroveProviders (already wraps all hub routes in app/layout.tsx).
 */
export function ProductCard({ product, editorialNote }: Props) {
  const { product: p, vendor } = product;
  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency ?? "USD",
  }).format(p.price);

  const cardData: ProductCardData = {
    name: p.name,
    priceFormatted,
    imageUrl: p.imageUrl ? `${vendor.odoo.apiUrl}${p.imageUrl}` : null,
    href: `/marketplace/${vendor.slug}/${p.slug}`,
    vendorName: vendor.name,
  };

  return (
    <UiProductCard
      product={cardData}
      editorialNote={editorialNote}
      accentColor={vendor.brandColor}
    />
  );
}
