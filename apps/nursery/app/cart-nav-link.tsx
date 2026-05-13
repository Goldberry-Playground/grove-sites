"use client";

import Link from "next/link";
import { useCart } from "../lib/cart-store";

export function CartNavLink() {
  const { totalQuantity, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
    >
      Cart
      {hydrated && totalQuantity > 0 && (
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-white text-xs font-medium">
          {totalQuantity}
        </span>
      )}
    </Link>
  );
}
