// Client-safe entry. Components, the cart store, and pure cart functions
// live here. Server-only route factories live in ./server so the bundler
// can keep them out of client JS.

export { CartProvider, useCart, type CartItem } from "./cart-store";
export {
  addItem,
  setItemQuantity,
  removeItem,
  totalQuantity,
  subtotal,
  validateCartItems,
  cartStorageKey,
} from "./cart-reducer";
export { CartNavLink } from "./components/CartNavLink";
export { AddToCartButton } from "./components/AddToCartButton";
export { MiniCartDrawer } from "./components/MiniCartDrawer";
export { StickyAddToCartBar } from "./components/StickyAddToCartBar";
export { CartPage } from "./components/CartPage";
export { CheckoutPage } from "./components/CheckoutPage";
export { CheckoutCancelPage } from "./components/CheckoutCancelPage";
