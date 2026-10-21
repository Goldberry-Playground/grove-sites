// @grove/ui barrel. Components are added here as they're lifted (Phase 3+).
export * from "./link-context";
export { Button, type ButtonProps } from "./Button";

// Cohesion + nav
export { SiblingStrip, type SiblingStripProps, type SiblingSite } from "./SiblingStrip";
export { NavLink, type NavLinkProps } from "./NavLink";
export { CartNavLink, type CartNavLinkProps } from "./CartNavLink";

// Hub cards
export {
  ProductCard,
  PRODUCT_CARD_IMAGE_SIZE,
  type ProductCardProps,
  type ProductCardData,
} from "./ProductCard";
export { VendorCard, type VendorCardProps } from "./VendorCard";
export { BuyAtVendorForm, type BuyAtVendorFormProps } from "./BuyAtVendorForm";
export {
  CaptureForm,
  isPlausibleEmail,
  MULTIBRAND_OPT_IN_LABEL,
  NEWSLETTER_CONSENT_TEXT,
  REQUEST_CONSENT_TEXT,
  NEWSLETTER_SUCCESS_MESSAGE,
  type CaptureFormProps,
  type CaptureBrand,
  type CaptureSource,
} from "./CaptureForm";
// Shared privacy notice, mounted at /privacy on every Grove site (GOL-3456).
export {
  PrivacyNotice,
  GROVE_BRAND_NAMES,
  GROVE_POSTAL_ADDRESS,
  GROVE_PRIVACY_EMAIL,
  GROVE_PRIVACY_PHONE,
  type PrivacyNoticeProps,
} from "./PrivacyNotice";
export { JournalProductEmbed, type JournalProductEmbedProps } from "./JournalProductEmbed";

// One-CTA-per-page arbitration (GOL-2178): footer newsletter suppresses itself
// when a page registers a higher-priority capture (restock / state).
export {
  CaptureArbiterProvider,
  CaptureSlot,
  type CaptureSlotProps,
  type CapturePriority,
} from "./CaptureArbiter";

// Shop nav + hero
export { HeroSlideshow, type HeroSlideshowProps, type HeroSlide } from "./HeroSlideshow";
export { ShopSubHeader, type ShopSubHeaderProps, type ShopCategory } from "./ShopSubHeader";
export { CategoryBar, type CategoryBarProps, type CategoryBarItem } from "./CategoryBar";

// Cart-coupled checkout (presentational; cart state via props/callbacks — see cart-contract)
export {
  type GroveCartLineItem,
  type GroveDueToday,
  DEFAULT_TAX_RATE_ESTIMATE,
} from "./cart-contract";
export { AddToCartButton, type AddToCartButtonProps } from "./AddToCartButton";
export { StickyAddToCartBar, type StickyAddToCartBarProps } from "./StickyAddToCartBar";
export { MiniCartDrawer, type MiniCartDrawerProps } from "./MiniCartDrawer";
export { type GroveTrustItem, type GroveTrustIconName } from "./trust-items";
export { TrustIcon, type TrustIconProps } from "./TrustIcon";
export { GlyphIcon, type GlyphIconProps, type GroveGlyphIconName } from "./GlyphIcon";
export { CartPage, type CartPageProps } from "./CartPage";
export {
  CheckoutPage,
  type CheckoutPageProps,
  type GroveCheckoutOrder,
  type GroveFulfillment,
  type GroveCheckoutContact,
  type GroveCheckoutShipping,
  type GroveCheckoutPaymentMethod,
  type GroveShipToOption,
  type GrovePickupCopy,
  type GrovePromoPreview,
} from "./CheckoutPage";
export { TierNudge } from "./TierNudge";
export {
  CheckoutReview,
  type CheckoutReviewProps,
  type CheckoutReviewLine,
} from "./CheckoutReview";
