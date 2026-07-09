"use client";

import { useCart } from "@grove/checkout";
import { CartNavLink as UiCartNavLink } from "@grove/ui-kit";

/**
 * Thin client wrapper: reads the cart count from the app's `useCart()` store
 * and feeds it to the decoupled `@grove/ui-kit` CartNavLink as a `count` prop
 * (mirrors the NavLink `usePathname` wrapper). The badge stays hidden until the
 * store hydrates, matching the pre-lift behavior and avoiding an SSR mismatch.
 */
export function CartNavLink() {
  const { totalQuantity, hydrated } = useCart();
  return <UiCartNavLink count={hydrated ? totalQuantity : 0} />;
}
