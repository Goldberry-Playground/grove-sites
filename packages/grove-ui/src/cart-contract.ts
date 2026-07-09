/**
 * Cart-state contract for the lifted checkout components.
 *
 * The five checkout components (AddToCartButton, StickyAddToCartBar,
 * MiniCartDrawer, CartPage, CheckoutPage) used to reach into `@grove/checkout`'s
 * `useCart()` store directly, which tied them to that store, to `next/*`, and to
 * one app's data shape — so they could not live in the shared kit.
 *
 * Here they are PRESENTATIONAL: every piece of cart state arrives via props and
 * every mutation leaves via a callback. `@grove/checkout` keeps the store and
 * ships thin "connected" wrappers that bind `useCart()` to these props, so app
 * call sites are unchanged. This is the container/presentational split.
 *
 * Coordinated with Engineering-Alice as the cart-state contract for GOL-115.
 */

/**
 * One line in the cart. Mirrors `@grove/checkout`'s `CartItem` exactly so the
 * connected wrappers pass the store's items straight through — no re-mapping.
 */
export interface GroveCartLineItem {
  /** Odoo product-variant id — the cart's stable line key. */
  variantId: number;
  /** Product-template id, used to build the product-detail href. */
  templateId: number;
  /** Display name. */
  name: string;
  /** Unit price (not line total); the component multiplies by quantity. */
  price: number;
  /** Fully-resolved image URL, or omit/empty for a blank frame. */
  imageUrl?: string;
  /** Quantity of this variant in the cart. */
  quantity: number;
}

/**
 * The single knob for the honest cart/checkout tax preview. Final tax is
 * computed server-side at order placement; this only drives the on-page
 * estimate. Kept a prop (not a token) so a brand in another tax jurisdiction
 * can override it without a fork. WV state 6% + municipal 1% ⇒ 0.07 default.
 */
export const DEFAULT_TAX_RATE_ESTIMATE = 0.07;
