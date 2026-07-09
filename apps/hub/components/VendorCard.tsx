"use client";

import { VendorCard as UiVendorCard } from "@grove/ui-kit";
import type { Vendor } from "../data/marketplace";
import { GroveNextProviders } from "./grove-adapters";

type Props = {
  vendor: Vendor;
};

/**
 * Marketplace vendor card. Thin app wrapper over @grove/ui-kit's VendorCard
 * (GOL-139): maps the vendor domain shape to props and injects the Next Link.
 * The per-sub-brand brandColor drives the top-border + name accent.
 */
export function VendorCard({ vendor }: Props) {
  return (
    <GroveNextProviders>
      <UiVendorCard
        name={vendor.name}
        tagline={vendor.tagline}
        href={`/marketplace/vendor/${vendor.slug}`}
        accentColor={vendor.brandColor}
      />
    </GroveNextProviders>
  );
}
