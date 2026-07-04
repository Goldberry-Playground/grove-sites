import { sha256Hex } from "./hash";
import { emit } from "./sinks";

/**
 * Funnel step 1 — a product variant was added to the cart. We ship `variant_id`
 * (low-cardinality) rather than the product name: the name is high-cardinality
 * free text that bloats Plausible's custom-property table and buys nothing the
 * catalog can't join back from the id.
 */
export function trackAddToCart(input: {
  variantId: number | string;
  price: number;
  quantity: number;
}): void {
  emit("add_to_cart", {
    variant_id: String(input.variantId),
    price: input.price,
    quantity: input.quantity,
  });
}

/** Funnel step 2 — the checkout form was submitted. */
export function trackBeginCheckout(input: { itemCount: number; subtotal: number }): void {
  emit("begin_checkout", {
    item_count: input.itemCount,
    subtotal: input.subtotal,
  });
}

/**
 * Funnel step 3 — an order was confirmed. The raw order number NEVER leaves the
 * browser un-hashed: we ship SHA-256(orderName) as `order_id_hash` so the funnel
 * can be stitched together without exposing a customer-guessable identifier.
 */
export async function trackPurchase(input: {
  orderName: string;
  itemCount: number;
  total: number;
}): Promise<void> {
  const orderIdHash = await sha256Hex(input.orderName);
  emit("purchase", {
    order_id_hash: orderIdHash,
    item_count: input.itemCount,
    total: input.total,
  });
}
