import { CartPage } from "@grove/checkout";

// GGG Woodworking storefront — the trust strip speaks to handmade wood, not the
// nursery's live-plant "arrive-alive" promise (GOL-1090).
export default function Page() {
  return <CartPage brand="ggg" />;
}
