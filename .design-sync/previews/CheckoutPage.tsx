import { CheckoutPage, type GroveCartLineItem } from "@grove/ui-kit";
import { SAMPLE_PRODUCT_APPLE, SAMPLE_PRODUCT_GRAPE } from "./_sample-images";

const items: GroveCartLineItem[] = [
  { variantId: 2, templateId: 2, name: "Honeycrisp Apple Tree (3 gal)", price: 38, imageUrl: SAMPLE_PRODUCT_APPLE, quantity: 2 },
  { variantId: 5, templateId: 5, name: "Concord Grape Vine (1 gal)", price: 18.5, imageUrl: SAMPLE_PRODUCT_GRAPE, quantity: 1 },
];
const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

export const Default = () => (
  <CheckoutPage items={items} subtotal={subtotal} onPlaceOrder={() => {}} />
);

export const EmptyCart = () => (
  <CheckoutPage items={[]} subtotal={0} onPlaceOrder={() => {}} />
);
