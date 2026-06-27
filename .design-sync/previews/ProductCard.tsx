import { ProductCard } from "@grove/ui-kit";
import { SAMPLE_PRODUCT_APPLE, SAMPLE_PRODUCT_GRAPE } from "./_sample-images";

// Authored preview cards (each export = one labeled card). Real JSX, real props.
// Imagery is self-contained (owned, optimized, base64) — no remote/CDN dependency.

const honeycrispApples = {
  name: "Honeycrisp Apples",
  priceFormatted: "$6.50",
  imageUrl: SAMPLE_PRODUCT_APPLE,
  href: "/marketplace/goldberry/honeycrisp-apples",
  vendorName: "Goldberry Grove Farm",
};

const concordGrapes = {
  name: "Concord Grapes",
  priceFormatted: "$8.00",
  imageUrl: SAMPLE_PRODUCT_GRAPE,
  href: "/marketplace/goldberry/concord-grapes",
  vendorName: "Goldberry Grove Farm",
};

const fernStarter = {
  name: "Lady Fern Starter (4\" pot)",
  priceFormatted: "$12.00",
  imageUrl: null,
  href: "/marketplace/nursery/lady-fern-starter",
  vendorName: "At The Grove Nursery",
};

export const Default = () => <ProductCard product={honeycrispApples} />;

export const WithAccent = () => (
  <ProductCard product={concordGrapes} accentColor="#5A2A4B" />
);

export const WithEditorialNote = () => (
  <ProductCard
    product={honeycrispApples}
    accentColor="#7F4F1D"
    editorialNote="Crisp, honey-sweet, and grown in the Grove's oldest orchard rows."
  />
);

export const NoImage = () => (
  <ProductCard product={fernStarter} accentColor="#1F3F2B" />
);
