import { JournalProductEmbed as UiJournalProductEmbed } from "@grove/ui-kit";
import { fetchProductByVendorSlug } from "../lib/marketplace";
import type { JournalProductLink } from "../data/marketplace";

type Props = {
  link: JournalProductLink;
};

/**
 * Async server wrapper: fetches the referenced product, maps it to
 * ProductCardData, and delegates rendering to @grove/ui-kit JournalProductEmbed.
 * Silently renders nothing if the product no longer exists.
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
    <UiJournalProductEmbed
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
