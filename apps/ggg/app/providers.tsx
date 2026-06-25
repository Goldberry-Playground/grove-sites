"use client";

import type { ReactNode } from "react";
import { CartProvider, MiniCartDrawer } from "@grove/checkout";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <MiniCartDrawer />
    </CartProvider>
  );
}
