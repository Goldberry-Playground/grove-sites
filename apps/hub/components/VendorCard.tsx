import { VendorCard as UiVendorCard } from "@grove/ui-kit";
import type { Vendor } from "../data/marketplace";

type Props = {
  vendor: Vendor;
};

/**
 * Hub adapter: maps a Vendor record onto the presentational @grove/ui-kit
 * VendorCard. Accent color (vendor.brandColor) moves from inline styles to
 * the `--vendor-card-accent` CSS-variable mechanism. Link is injected via
 * GroveProviders (already wraps all hub routes in app/layout.tsx).
 */
export function VendorCard({ vendor }: Props) {
  return (
    <UiVendorCard
      name={vendor.name}
      tagline={vendor.tagline}
      href={`/marketplace/vendor/${vendor.slug}`}
      accentColor={vendor.brandColor}
    />
  );
}
