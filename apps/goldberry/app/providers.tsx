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
      {/* Mini-cart drawer — globally mounted so any Add-to-Cart anywhere on the
          site can slide it open. Renders nothing until drawerOpen flips true. */}
      <MiniCartDrawer />
    </CartProvider>
  );
}
