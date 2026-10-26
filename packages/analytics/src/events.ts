import { sha256Hex } from "./hash";
import { emit } from "./sinks";
import type { AnalyticsProps } from "./types";

// Funnel events that represent a one-shot step (checkout start, checkout error)
// are deduped per page session: a double submit, a React StrictMode double
// effect, or a retry of the same failing step must not inflate the funnel
// counts the rum-funnel-drop / rum-checkout-error alerts baseline against.
// `purchase` keeps its own ref guard at the PurchaseTracker call site.
const firedKeys = new Set<string>();

function emitOnce(key: string, name: string, props?: AnalyticsProps): void {
  if (firedKeys.has(key)) return;
  firedKeys.add(key);
  emit(name, props);
}

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

/**
 * Funnel step 2 — the checkout form was submitted. Deduped per page session so a
 * buyer who submits twice (or a double-invoked effect) counts as one start.
 */
export function trackBeginCheckout(input: { itemCount: number; subtotal: number }): void {
  emitOnce("begin_checkout", "begin_checkout", {
    item_count: input.itemCount,
    subtotal: input.subtotal,
  });
}

/**
 * Funnel error — a checkout attempt failed at `stage` (a low-cardinality label
 * like "network" or "session", NEVER the raw error message, which can echo user
 * input). Deduped per stage so one flaky step retried several times records
 * once; a failure at a different stage still records.
 */
export function trackCheckoutError(input: { stage: string; code?: string }): void {
  emitOnce(`checkout_error:${input.stage}`, "checkout_error", {
    stage: input.stage,
    ...(input.code ? { code: input.code } : {}),
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
