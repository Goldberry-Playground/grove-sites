"use client";

import { ProductCard as UiProductCard } from "@grove/ui-kit";
import type { HubProduct } from "../lib/marketplace";
import { GroveNextProviders } from "./grove-adapters";

type Props = {
  product: HubProduct;
  editorialNote?: string;
};

/**
 * Federated product card. Thin app wrapper over @grove/ui-kit's presentational
 * ProductCard (GOL-139): maps the hub's domain shape to the card's props and
 * injects Next's Link/Image via context. Vendor brandColor drives the accent
 * (bottom border + vendor eyebrow) so mixed-vendor grids stay distinguishable.
 */
export function ProductCard({ product, editorialNote }: Props) {
  const { product: p, vendor } = product;
  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency ?? "USD",
  }).format(p.price);

  return (
    <GroveNextProviders>
      <UiProductCard
        product={{
          name: p.name,
          priceFormatted,
          imageUrl: p.imageUrl ? `${vendor.odoo.apiUrl}${p.imageUrl}` : null,
          href: `/marketplace/${vendor.slug}/${p.slug}`,
          vendorName: vendor.name,
        }}
        editorialNote={editorialNote}
        accentColor={vendor.brandColor}
      />
    </GroveNextProviders>
  );
}
