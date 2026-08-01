import { CartPage } from "@grove/checkout";

// Goldberry hub storefront — pantry goods (flour, jams, freeze-dried fruit,
// mushroom kits); the trust strip must not carry the nursery's live-plant
// "arrive-alive" promise (GOL-1090).
export default function Page() {
  return <CartPage brand="goldberry" />;
}
