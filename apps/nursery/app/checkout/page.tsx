import { CheckoutPage } from "@grove/checkout";

// Nursery storefront — brand-appropriate checkout trust copy (the arrive-alive
// promise is true for live plants). Wrapped in a no-prop Page so the default
// export satisfies Next's PageProps constraint (GOL-1090).
export default function Page() {
  return <CheckoutPage brand="nursery" />;
}
