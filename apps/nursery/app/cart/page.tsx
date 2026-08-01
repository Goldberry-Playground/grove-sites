import { CartPage } from "@grove/checkout";

// Nursery storefront — the live-plant "arrive-alive" trust strip is true here
// (it ships living plants, per /shipping-warranty). Wrapped in a no-prop Page
// so the default export satisfies Next's PageProps constraint (GOL-1090).
export default function Page() {
  return <CartPage brand="nursery" />;
}
