"use client";

import type { ReactNode } from "react";
import { AnalyticsProvider } from "@grove/analytics";
import type { AnalyticsConfig } from "@grove/analytics";
import { CartProvider, MiniCartDrawer } from "@grove/checkout";

export function Providers({
  children,
  analyticsConfig,
}: {
  children: ReactNode;
  analyticsConfig: AnalyticsConfig | null;
}) {
  return (
    <CartProvider>
      <AnalyticsProvider config={analyticsConfig} />
      {children}
      <MiniCartDrawer />
    </CartProvider>
  );
}
