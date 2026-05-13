"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addItem,
  cartStorageKey,
  removeItem,
  setItemQuantity,
  subtotal as calculateSubtotal,
  totalQuantity as calculateTotalQuantity,
  validateCartItems,
  type CartItem,
} from "./cart-reducer";

// Multi-tenant deployments must NOT share a localStorage key — otherwise
// a customer's cart from goldberrygrove.farm leaks into nursery.com if
// either site is ever served from a shared domain or a developer is
// testing both locally. NEXT_PUBLIC_TENANT_ID is baked at build time.
const STORAGE_KEY = cartStorageKey(process.env.NEXT_PUBLIC_TENANT_ID);

export type { CartItem };

type CartContextValue = {
  items: CartItem[];
  /** Hydrated from localStorage. False during SSR and initial client render. */
  hydrated: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  totalQuantity: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return validateCartItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((current) => addItem(current, item, quantity));
    },
    [],
  );

  const setQuantity = useCallback((variantId: number, quantity: number) => {
    setItems((current) => setItemQuantity(current, variantId, quantity));
  }, []);

  const remove = useCallback((variantId: number) => {
    setItems((current) => removeItem(current, variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalQuantity = useMemo(() => calculateTotalQuantity(items), [items]);
  const subtotal = useMemo(() => calculateSubtotal(items), [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      hydrated,
      add,
      setQuantity,
      remove,
      clear,
      totalQuantity,
      subtotal,
    }),
    [items, hydrated, add, setQuantity, remove, clear, totalQuantity, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
