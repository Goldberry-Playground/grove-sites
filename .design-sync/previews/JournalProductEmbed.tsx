import { JournalProductEmbed } from "@grove/ui-kit";
import { SAMPLE_PRODUCT_APPLE, SAMPLE_PRODUCT_GRAPE } from "./_sample-images";

// Authored preview cards (each export = one labeled card). Real JSX, real props.
// Imagery is self-contained (owned, optimized, base64) — no remote/CDN dependency.

const concordGrapes = {
  name: "Concord Grapes",
  priceFormatted: "$8.00",
  imageUrl: SAMPLE_PRODUCT_GRAPE,
  href: "/marketplace/goldberry/concord-grapes",
  vendorName: "Goldberry Grove Farm",
};

const honeycrispApples = {
  name: "Honeycrisp Apples",
  priceFormatted: "$6.50",
  imageUrl: SAMPLE_PRODUCT_APPLE,
  href: "/marketplace/goldberry/honeycrisp-apples",
  vendorName: "Goldberry Grove Farm",
};

export const Inline = () => (
  <JournalProductEmbed product={concordGrapes} position="inline" accentColor="#7F4F1D" />
);

export const Sidebar = () => (
  <JournalProductEmbed
    product={honeycrispApples}
    position="sidebar"
    accentColor="#5A2A4B"
  />
);

export const Footer = () => (
  <JournalProductEmbed
    product={concordGrapes}
    position="footer"
    accentColor="#7F4F1D"
    caption="Featured in this story:"
  />
);
