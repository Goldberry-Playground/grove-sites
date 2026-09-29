// Pure cart reducer functions. Extracted from the React store so they can
// be unit-tested without a DOM — and so all three storefronts share one
// implementation. Any change to cart semantics happens here once.

export type CartItem = {
  /** product.product id — the actual SKU/variant. Used as the unique line key. */
  variantId: number;
  /** product.template id — used to link back to the shop detail page. */
  templateId: number;
  /** Display name including variant attributes (e.g. "Apple Tree (3 gal, Pot)"). */
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  /**
   * This line is farm-pickup-only and can never be shipped (Odoo
   * `grove_pickup_only`, GOL-2587 P1; resolved on the PDP through `isPickupOnly`
   * so a potted Box-Engine-v2 line counts too). Carried on the line, like price
   * and name, because the cart and the checkout form have no product payload to
   * re-read: checkout locks fulfillment to pickup when ANY line has it (GOL-2588),
   * which is exactly the order the backend gate would otherwise reject with a 400.
   *
   * Optional: a cart persisted before this field existed simply has no flag, which
   * restores the pre-GOL-2588 behaviour for that line (the backend still rejects
   * the ship order, so the failure mode is unchanged, never a wrong charge).
   */
  pickupOnly?: boolean;
};

/**
 * Add an item to the cart. If the variantId already exists, increments the
 * existing line's quantity by `quantity`. Otherwise appends a new line.
 *
 * Pure — never mutates `items`.
 */
export function addItem(
  items: readonly CartItem[],
  newItem: Omit<CartItem, "quantity">,
  quantity = 1,
): CartItem[] {
  const existing = items.find((i) => i.variantId === newItem.variantId);
  if (existing) {
    return items.map((i) =>
      i.variantId === newItem.variantId
        ? { ...i, quantity: i.quantity + quantity }
        : i,
    );
  }
  return [...items, { ...newItem, quantity }];
}

/**
 * Set a line's exact quantity. Quantity ≤ 0 removes the line entirely
 * (matches the old `setQuantity(id, 0)` shorthand for removal).
 */
export function setItemQuantity(
  items: readonly CartItem[],
  variantId: number,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) {
    return items.filter((i) => i.variantId !== variantId);
  }
  return items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i));
}

/**
 * Remove a line by variantId. No-op if the line doesn't exist.
 */
export function removeItem(
  items: readonly CartItem[],
  variantId: number,
): CartItem[] {
  return items.filter((i) => i.variantId !== variantId);
}

export function totalQuantity(items: readonly CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function subtotal(items: readonly CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/**
 * localStorage is user-writable — anyone can open DevTools and inject
 * malformed JSON. This filter drops anything that doesn't match the
 * expected CartItem shape so a tampered cart can't crash the page.
 *
 * Returns a clean array of CartItem; non-array input → [].
 */
export function validateCartItems(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is CartItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as CartItem).variantId === "number" &&
      typeof (item as CartItem).templateId === "number" &&
      typeof (item as CartItem).name === "string" &&
      typeof (item as CartItem).price === "number" &&
      typeof (item as CartItem).imageUrl === "string" &&
      typeof (item as CartItem).quantity === "number" &&
      (item as CartItem).quantity > 0 &&
      // Optional flag: absent is fine (a cart from before GOL-2588); present but
      // not a boolean means a tampered line, so drop it rather than coerce a
      // truthy string into "this cart is pickup-only".
      ((item as CartItem).pickupOnly === undefined ||
        typeof (item as CartItem).pickupOnly === "boolean"),
  );
}

/**
 * The localStorage key includes the tenant slug so multi-tenant deployments
 * on the same domain don't bleed carts across stores. Defaults to "grove"
 * when the env var isn't set (e.g., during SSR or tests).
 */
export function cartStorageKey(tenantId: string | undefined): string {
  return `${tenantId ?? "grove"}-cart-v1`;
}
