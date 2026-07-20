"use client";

import Link from "next/link";
import { Button } from "@grove/ui";

/**
 * Stripe "cancel / back" landing (`/checkout/cancel`). Reassures the buyer that
 * nothing was charged and — crucially — that their cart is intact (we never
 * clear the cart on the redirect, only after a successful payment), then points
 * them straight back to the cart to try again. No dark patterns: a plain,
 * friendly exit with an easy return path.
 */
export function CheckoutCancelPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20 text-2xl text-primary"
      >
        ↩
      </div>
      <h1 className="text-3xl font-display font-bold text-primary mb-3">
        Payment canceled
      </h1>
      <p className="text-foreground/70 mb-2">
        No worries — you weren&apos;t charged, and{" "}
        <span className="font-medium">your cart is saved</span>. Pick up right
        where you left off whenever you&apos;re ready.
      </p>
      <p className="text-foreground/60 text-sm mb-8">
        Changed your mind about something? You can edit your cart before checking
        out again.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/cart">
          <Button variant="primary" size="md">
            Return to Cart
          </Button>
        </Link>
        <Link href="/shop">
          <Button variant="secondary" size="md">
            Keep Browsing
          </Button>
        </Link>
      </div>
    </div>
  );
}
