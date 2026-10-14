import { CartPage } from "@grove/checkout";

// Goldberry farm storefront: Printify shirts (GOL-3315). The trust strip must
// not carry the nursery's live-plant "arrive-alive" promise (GOL-1090). The
// cart has no address, so shipping stays "At checkout" here; the quote route
// is wired for parity with the checkout page.
export default function Page() {
  return <CartPage brand="goldberry" depositQuoteHref="/api/cart/quote" />;
}
