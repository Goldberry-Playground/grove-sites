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
export {
  CaptureForm,
  type CaptureFormProps,
  type CaptureBrand,
  type CaptureSource,
} from "./CaptureForm";
export { JournalProductEmbed, type JournalProductEmbedProps } from "./JournalProductEmbed";

// Shop nav + hero
export { HeroSlideshow, type HeroSlideshowProps, type HeroSlide } from "./HeroSlideshow";
export { ShopSubHeader, type ShopSubHeaderProps, type ShopCategory } from "./ShopSubHeader";
export { CategoryBar, type CategoryBarProps, type CategoryBarItem } from "./CategoryBar";

// Cart-coupled checkout (presentational; cart state via props/callbacks — see cart-contract)
export { type GroveCartLineItem, DEFAULT_TAX_RATE_ESTIMATE } from "./cart-contract";
export { AddToCartButton, type AddToCartButtonProps } from "./AddToCartButton";
export { StickyAddToCartBar, type StickyAddToCartBarProps } from "./StickyAddToCartBar";
export { MiniCartDrawer, type MiniCartDrawerProps } from "./MiniCartDrawer";
export { type GroveTrustItem } from "./trust-items";
export {
  CartPage,
  type CartPageProps,
  DEFAULT_CART_TRUST_ITEMS,
} from "./CartPage";
export {
  CheckoutPage,
  type CheckoutPageProps,
  type GroveCheckoutOrder,
  type GroveCheckoutContact,
  type GroveCheckoutShipping,
  type GroveCheckoutPaymentMethod,
  type GroveShipToOption,
} from "./CheckoutPage";
export {
  CheckoutReview,
  type CheckoutReviewProps,
  type CheckoutReviewLine,
} from "./CheckoutReview";
