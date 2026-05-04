// Pure cart reducer functions, extracted from cart-store.tsx so they can
// be unit-tested without React. Same shapes as the Context provider — the
// provider is a thin wrapper that calls these and stores the result in
// useState.

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
      (item as CartItem).quantity > 0,
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
