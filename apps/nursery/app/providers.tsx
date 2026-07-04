"use client";

import type { ReactNode } from "react";
import { AnalyticsProvider } from "@grove/analytics";
import { CartProvider, MiniCartDrawer } from "@grove/checkout";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <AnalyticsProvider />
      {children}
      <MiniCartDrawer />
    </CartProvider>
  );
}
