"use client";

import { ProductCard as UiProductCard } from "@grove/ui-kit";
import type { HubProduct } from "../lib/marketplace";
import { MARKETPLACE_CARD_SIZES, odooImageAt } from "../lib/odoo-image";
import { GroveNextProviders } from "./grove-adapters";

type Props = {
  product: HubProduct;
  editorialNote?: string;
  /**
   * The first card in the grid (above the fold at 390 px and 1440 px). Its
   * photo is the LCP element, so it loads eagerly at high fetch priority;
   * every other card stays lazy (GOL-3477).
   */
  priority?: boolean;
};

/**
 * Federated product card. Thin app wrapper over @grove/ui-kit's presentational
 * ProductCard (GOL-139): maps the hub's domain shape to the card's props and
 * injects Next's Link/Image via context. Vendor brandColor drives the accent
 * (bottom border + vendor eyebrow) so mixed-vendor grids stay distinguishable.
 */
export function ProductCard({ product, editorialNote, priority }: Props) {
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
          // One resizable master per card (image_1024), whichever variant the
          // API handed us; next/image serves the sized file from it.
          imageUrl: p.imageUrl ? odooImageAt(`${vendor.odoo.apiUrl}${p.imageUrl}`) : null,
          href: `/marketplace/${vendor.slug}/${p.slug}`,
          vendorName: vendor.name,
        }}
        editorialNote={editorialNote}
        accentColor={vendor.brandColor}
        imagePriority={priority}
        imageSizes={MARKETPLACE_CARD_SIZES}
      />
    </GroveNextProviders>
  );
}
