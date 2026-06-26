import { VendorCard } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

export const Goldberry = () => (
  <VendorCard
    name="Goldberry Grove Farm"
    tagline="Heirloom vegetables and cut flowers, grown an hour from your table."
    href="/marketplace/vendor/goldberry"
    accentColor="#5A2A4B"
  />
);

export const Nursery = () => (
  <VendorCard
    name="At The Grove Nursery"
    tagline="Native perennials, ferns, and shade trees raised for our climate."
    href="/marketplace/vendor/nursery"
    accentColor="#1F3F2B"
  />
);

export const Woodworking = () => (
  <VendorCard
    name="George George George Woodworking"
    tagline="Hand-built furniture and serving boards in locally felled hardwood."
    href="/marketplace/vendor/ggg"
    accentColor="#3A2418"
  />
);

export const NoAccent = () => (
  <VendorCard
    name="Grove Pantry"
    tagline="Small-batch preserves and ferments from across the collective."
    href="/marketplace/vendor/pantry"
  />
);

export const CustomCta = () => (
  <VendorCard
    name="Goldberry Grove Farm"
    tagline="Heirloom vegetables and cut flowers, grown an hour from your table."
    href="/marketplace/vendor/goldberry"
    accentColor="#5A2A4B"
    cta="Meet the growers →"
  />
);
