import { CheckoutPage } from "@grove/checkout";

// Goldberry farm storefront: Printify shirts (GOL-3315). Shipping is quoted
// live from Printify through /api/cart/quote once the shopper has typed state
// and ZIP; submit stays blocked until an amount exists. Brand-appropriate
// trust copy, not the nursery's live-plant promise (GOL-1090).
export default function Page() {
  return <CheckoutPage brand="goldberry" depositQuoteHref="/api/cart/quote" liveShipping />;
}
