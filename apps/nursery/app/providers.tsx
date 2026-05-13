"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@grove/checkout";

export function Providers({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
