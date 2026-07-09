import { CartPage, type GroveCartLineItem } from "@grove/ui-kit";
import { SAMPLE_PRODUCT_APPLE, SAMPLE_PRODUCT_GRAPE } from "./_sample-images";

const items: GroveCartLineItem[] = [
  { variantId: 2, templateId: 2, name: "Honeycrisp Apple Tree (3 gal)", price: 38, imageUrl: SAMPLE_PRODUCT_APPLE, quantity: 2 },
  { variantId: 5, templateId: 5, name: "Concord Grape Vine (1 gal)", price: 18.5, imageUrl: SAMPLE_PRODUCT_GRAPE, quantity: 3 },
];
const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

export const Filled = () => (
  <CartPage
    items={items}
    subtotal={subtotal}
    totalQuantity={totalQuantity}
    onSetQuantity={() => {}}
    onRemove={() => {}}
  />
);

export const EmptyCart = () => (
  <CartPage
    items={[]}
    subtotal={0}
    totalQuantity={0}
    onSetQuantity={() => {}}
    onRemove={() => {}}
  />
);
