import { CartPage } from "@grove/checkout";

// Nursery storefront — the live-plant "arrive-alive" trust strip is true here
// (it ships living plants, per /shipping-warranty). Wrapped in a no-prop Page
// so the default export satisfies Next's PageProps constraint (GOL-1090).
// `depositQuoteHref` lets the summary show the flat $10 reservation deposit
// when the cart takes one (GOL-2233) instead of the goods subtotal alone.
export default function Page() {
  return <CartPage brand="nursery" depositQuoteHref="/api/cart/quote" />;
}
