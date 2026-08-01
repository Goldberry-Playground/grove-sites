import { CheckoutPage } from "@grove/checkout";

// Goldberry hub storefront — brand-appropriate checkout trust copy for pantry
// goods, not the nursery's live-plant promise (GOL-1090).
export default function Page() {
  return <CheckoutPage brand="goldberry" />;
}
