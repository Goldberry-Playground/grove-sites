"use client";

import type { ReactNode } from "react";
import { CartProvider } from "../lib/cart-store";

export function Providers({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
