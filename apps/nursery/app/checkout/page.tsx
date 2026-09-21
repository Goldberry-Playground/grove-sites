import { CheckoutPage } from "@grove/checkout";

// Nursery storefront — brand-appropriate checkout trust copy (the arrive-alive
// promise is true for live plants). Wrapped in a no-prop Page so the default
// export satisfies Next's PageProps constraint (GOL-1090).
// `depositQuoteHref` lets the form's summary show the flat $10 reservation
// deposit when the cart takes one (GOL-2233), before the Stripe session exists.
export default function Page() {
  return <CheckoutPage brand="nursery" depositQuoteHref="/api/cart/quote" />;
}
