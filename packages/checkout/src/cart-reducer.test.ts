import { describe, it, expect } from "vitest";
import {
  addItem,
  cartStorageKey,
  removeItem,
  setItemQuantity,
  subtotal,
  totalQuantity,
  validateCartItems,
  type CartItem,
} from "./cart-reducer";

const apple: Omit<CartItem, "quantity"> = {
  variantId: 2,
  templateId: 2,
  name: "Honeycrisp Apple Tree (3 gal, Pot)",
  price: 38.0,
  imageUrl: "/web/image/product.product/2/image_128",
};

const birch: Omit<CartItem, "quantity"> = {
  variantId: 6,
  templateId: 3,
  name: "Heritage River Birch (5 gal, Pot)",
  price: 65.0,
  imageUrl: "/web/image/product.product/6/image_128",
};

describe("addItem", () => {
  it("appends a new line when the variantId is not already in the cart", () => {
    const result = addItem([], apple, 1);
    expect(result).toEqual([{ ...apple, quantity: 1 }]);
  });

  it("increments quantity on the existing line — does NOT duplicate", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    const result = addItem(initial, apple, 2);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });

  it("appends a new line for a different variant of the same template", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    const otherVariantSameTemplate = { ...apple, variantId: 3 }; // same templateId
    const result = addItem(initial, otherVariantSameTemplate, 1);
    expect(result).toHaveLength(2);
  });

  it("does NOT mutate the input array (immutability check)", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    const snapshot = JSON.stringify(initial);
    addItem(initial, birch, 1);
    expect(JSON.stringify(initial)).toBe(snapshot);
  });

  it("defaults quantity to 1 when not specified", () => {
    const result = addItem([], apple);
    expect(result[0].quantity).toBe(1);
  });
});

describe("setItemQuantity", () => {
  it("sets the exact quantity on the matching line", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    const result = setItemQuantity(initial, apple.variantId, 5);
    expect(result[0].quantity).toBe(5);
  });

  it("removes the line when quantity is 0", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 3 }];
    const result = setItemQuantity(initial, apple.variantId, 0);
    expect(result).toEqual([]);
  });

  it("removes the line when quantity is negative (defensive)", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 3 }];
    const result = setItemQuantity(initial, apple.variantId, -5);
    expect(result).toEqual([]);
  });

  it("is a no-op when variantId is not in the cart", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    const result = setItemQuantity(initial, 9999, 5);
    expect(result).toEqual(initial);
  });

  it("does NOT touch other lines", () => {
    const initial: CartItem[] = [
      { ...apple, quantity: 2 },
      { ...birch, quantity: 1 },
    ];
    const result = setItemQuantity(initial, apple.variantId, 5);
    expect(result.find((i) => i.variantId === birch.variantId)?.quantity).toBe(1);
  });
});

describe("removeItem", () => {
  it("removes the matching line", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    expect(removeItem(initial, apple.variantId)).toEqual([]);
  });

  it("is a no-op for unknown variantId", () => {
    const initial: CartItem[] = [{ ...apple, quantity: 1 }];
    expect(removeItem(initial, 9999)).toEqual(initial);
  });
});

describe("totalQuantity / subtotal", () => {
  const cart: CartItem[] = [
    { ...apple, quantity: 2 },
    { ...birch, quantity: 1 },
  ];

  it("totalQuantity sums quantities across lines", () => {
    expect(totalQuantity(cart)).toBe(3);
  });

  it("subtotal multiplies price × quantity per line", () => {
    expect(subtotal(cart)).toBe(38 * 2 + 65 * 1);
  });

  it("returns 0 for an empty cart", () => {
    expect(totalQuantity([])).toBe(0);
    expect(subtotal([])).toBe(0);
  });
});

describe("validateCartItems — defensive parsing of localStorage", () => {
  it("returns [] for non-array input", () => {
    expect(validateCartItems(null)).toEqual([]);
    expect(validateCartItems("not-an-array")).toEqual([]);
    expect(validateCartItems({ variantId: 1 })).toEqual([]);
  });

  it("drops items missing required fields", () => {
    const result = validateCartItems([
      { variantId: 1, templateId: 1, name: "ok", price: 1, imageUrl: "/", quantity: 1 },
      { variantId: 2 }, // incomplete — should be filtered
      "garbage", // string — should be filtered
      null,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe(1);
  });

  it("drops items with quantity ≤ 0 (tampered cart)", () => {
    const result = validateCartItems([
      { variantId: 1, templateId: 1, name: "ok", price: 1, imageUrl: "/", quantity: -1 },
      { variantId: 2, templateId: 2, name: "ok2", price: 1, imageUrl: "/", quantity: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it("drops items where price is not a number", () => {
    const result = validateCartItems([
      { variantId: 1, templateId: 1, name: "ok", price: "free", imageUrl: "/", quantity: 1 },
    ]);
    expect(result).toEqual([]);
  });
});

describe("cartStorageKey — multi-tenant safety", () => {
  it("includes the tenant slug to prevent cross-tenant cart bleed", () => {
    expect(cartStorageKey("goldberry")).toBe("goldberry-cart-v1");
    expect(cartStorageKey("ggg")).toBe("ggg-cart-v1");
    expect(cartStorageKey("nursery")).toBe("nursery-cart-v1");
  });

  it("falls back to grove for missing tenantId (defensive)", () => {
    expect(cartStorageKey(undefined)).toBe("grove-cart-v1");
  });

  it("never collides between two known tenants", () => {
    expect(cartStorageKey("goldberry")).not.toBe(cartStorageKey("nursery"));
  });
});

/**
 * GOL-2588: the pickup-only flag rides the cart line, like price and name, so the
 * checkout form can lock fulfillment without re-fetching the product. It is the
 * one field that decides whether a whole order may ship, so the localStorage
 * filter must not let a tampered value through, and an older cart that predates
 * the field must still load.
 */
describe("validateCartItems — pickupOnly flag (GOL-2588)", () => {
  const line = (extra: Record<string, unknown>) => ({
    variantId: 1,
    templateId: 1,
    name: "Remembrance Grove",
    price: 149,
    imageUrl: "/x.jpg",
    quantity: 1,
    ...extra,
  });

  it("preserves pickupOnly: true", () => {
    const result = validateCartItems([line({ pickupOnly: true })]);
    expect(result).toHaveLength(1);
    expect(result[0].pickupOnly).toBe(true);
  });

  it("preserves pickupOnly: false", () => {
    expect(validateCartItems([line({ pickupOnly: false })])[0].pickupOnly).toBe(false);
  });

  it("accepts a pre-GOL-2588 line with no flag at all", () => {
    const result = validateCartItems([line({})]);
    expect(result).toHaveLength(1);
    expect(result[0].pickupOnly).toBeUndefined();
  });

  it("drops a line whose pickupOnly is a non-boolean (tampered storage)", () => {
    // A truthy string must never be coerced into "this cart is pickup-only", and a
    // "false" string must never unlock shipping the backend would refuse.
    expect(validateCartItems([line({ pickupOnly: "true" })])).toEqual([]);
    expect(validateCartItems([line({ pickupOnly: 1 })])).toEqual([]);
    expect(validateCartItems([line({ pickupOnly: null })])).toEqual([]);
  });
});

describe("addItem — carries the pickup-only flag onto the new line (GOL-2588)", () => {
  it("stamps the flag from the PDP add", () => {
    const items = addItem([], {
      variantId: 9,
      templateId: 9,
      name: "Remembrance Grove",
      price: 149,
      imageUrl: "/x.jpg",
      pickupOnly: true,
    });
    expect(items[0].pickupOnly).toBe(true);
  });

  it("keeps the existing line's flag when the same variant is added again", () => {
    const first = addItem([], {
      variantId: 9,
      templateId: 9,
      name: "Remembrance Grove",
      price: 149,
      imageUrl: "/x.jpg",
      pickupOnly: true,
    });
    const second = addItem(first, {
      variantId: 9,
      templateId: 9,
      name: "Remembrance Grove",
      price: 149,
      imageUrl: "/x.jpg",
      pickupOnly: true,
    });
    expect(second).toHaveLength(1);
    expect(second[0].quantity).toBe(2);
    expect(second[0].pickupOnly).toBe(true);
  });
});
