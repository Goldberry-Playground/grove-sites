"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@grove/ui";
import { useCart } from "../../lib/cart-store";

const TAX_RATE_ESTIMATE = 0.07; // WV state 6% + municipal 1%; final tax computed at checkout

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function CartPage() {
  const { items, hydrated, setQuantity, remove, subtotal, totalQuantity } =
    useCart();

  // While hydrating from localStorage, show neutral state to avoid hydration
  // mismatch flash between server (always empty) and client (may have items).
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-primary mb-8">
          Your Cart
        </h1>
        <p className="text-foreground/50 text-sm">Loading cart...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-primary mb-8">
          Your Cart
        </h1>
        <div className="rounded-lg border border-primary/10 p-12 text-center">
          <p className="text-foreground/60 mb-6 text-lg">Your cart is empty.</p>
          <Link href="/shop">
            <Button variant="primary" size="md">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const taxEstimate = subtotal * TAX_RATE_ESTIMATE;
  const total = subtotal + taxEstimate;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-primary">
          Your Cart
        </h1>
        <span className="text-sm text-foreground/60">
          {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Line items */}
        <ul className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <li
              key={item.variantId}
              className="flex gap-4 rounded-lg border border-primary/10 p-4"
            >
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded bg-secondary/20">
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link
                    href={`/shop/${item.templateId}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm text-foreground/60 mt-1">
                    {formatPrice(item.price)} each
                  </p>
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex items-center border border-primary/20 rounded">
                    <button
                      className="px-3 py-1.5 text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
                      onClick={() =>
                        setQuantity(item.variantId, item.quantity - 1)
                      }
                      aria-label={`Decrease quantity of ${item.name}`}
                      disabled={item.quantity <= 1}
                    >
                      &minus;
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      className="px-3 py-1.5 text-foreground/60 hover:text-foreground transition-colors"
                      onClick={() =>
                        setQuantity(item.variantId, item.quantity + 1)
                      }
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                    <button
                      className="text-xs text-foreground/50 hover:text-red-600 transition-colors underline-offset-2 hover:underline"
                      onClick={() => remove(item.variantId)}
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Order summary */}
        <aside className="rounded-lg border border-primary/10 p-6 h-fit lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/70">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/70">
                Tax (estimated 7%)
                <span className="block text-xs text-foreground/40">
                  Final tax calculated at checkout
                </span>
              </dt>
              <dd>{formatPrice(taxEstimate)}</dd>
            </div>
            <div className="flex justify-between border-t border-primary/10 pt-3 mt-3 font-semibold text-base">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          <Link href="/checkout" className="block mt-6">
            <Button variant="primary" size="lg" className="w-full">
              Proceed to Checkout
            </Button>
          </Link>

          <Link
            href="/shop"
            className="mt-3 block text-center text-sm text-foreground/60 hover:text-primary transition-colors"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
