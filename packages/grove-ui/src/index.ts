// @grove/ui barrel. Components are added here as they're lifted (Phase 3+).
export * from "./link-context";
export { Button, type ButtonProps } from "./Button";

// Cohesion + nav
export { SiblingStrip, type SiblingStripProps, type SiblingSite } from "./SiblingStrip";
export { NavLink, type NavLinkProps } from "./NavLink";
export { CartNavLink, type CartNavLinkProps } from "./CartNavLink";

// Hub cards
export { ProductCard, type ProductCardProps, type ProductCardData } from "./ProductCard";
export { VendorCard, type VendorCardProps } from "./VendorCard";
export { BuyAtVendorForm, type BuyAtVendorFormProps } from "./BuyAtVendorForm";
export { JournalProductEmbed, type JournalProductEmbedProps } from "./JournalProductEmbed";

// Shop nav + hero
export { HeroSlideshow, type HeroSlideshowProps, type HeroSlide } from "./HeroSlideshow";
export { ShopSubHeader, type ShopSubHeaderProps, type ShopCategory } from "./ShopSubHeader";
export { CategoryBar, type CategoryBarProps, type CategoryBarItem } from "./CategoryBar";
