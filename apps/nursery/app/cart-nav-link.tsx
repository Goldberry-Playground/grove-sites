"use client";

import { useCart } from "@grove/checkout";
import { CartNavLink as UiCartNavLink } from "@grove/ui-kit";

/**
 * Thin client wrapper: the decoupled @grove/ui-kit CartNavLink takes a `count`
 * prop and reads no store, so the app supplies the cart count (mirrors the
 * NavLink `usePathname` wrapper). Badge stays hidden until the cart store has
 * hydrated to avoid an SSR/client count mismatch. See GOL-140 / GOL-113.
 */
export function CartNavLink() {
  const { totalQuantity, hydrated } = useCart();
  return <UiCartNavLink count={hydrated ? totalQuantity : 0} />;
}
