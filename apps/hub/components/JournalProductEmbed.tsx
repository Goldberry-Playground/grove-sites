import { fetchProductByVendorSlug } from "../lib/marketplace";
import type { JournalProductLink } from "../data/marketplace";
import { JournalProductEmbedView } from "./JournalProductEmbedView";

type Props = {
  link: JournalProductLink;
};

/**
 * Renders a product card inside a journal post. Async server component: resolves
 * the referenced product (silently renders nothing if it no longer exists in the
 * vendor's catalog), then hands presentational data to the ui-kit-backed client
 * view (GOL-139).
 */
export async function JournalProductEmbed({ link }: Props) {
  const hub = await fetchProductByVendorSlug(link.ref.vendor, link.ref.productSlug);
  if (!hub) return null;

  const { product: p, vendor } = hub;
  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency ?? "USD",
  }).format(p.price);

  return (
    <JournalProductEmbedView
      product={{
        name: p.name,
        priceFormatted,
        imageUrl: p.imageUrl ? `${vendor.odoo.apiUrl}${p.imageUrl}` : null,
        href: `/marketplace/${vendor.slug}/${p.slug}`,
        vendorName: vendor.name,
      }}
      position={link.position}
      accentColor={vendor.brandColor}
    />
  );
}
