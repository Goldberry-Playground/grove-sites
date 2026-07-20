import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@grove/ui";
import type { OdooClient, OrderDetail } from "@grove/odoo-client";
import { PurchaseTracker } from "./PurchaseTracker";
import { CheckoutSuccessEffects } from "./CheckoutSuccessEffects";
import { CHECKOUT_HANDOFF_COOKIE, decodeHandoff } from "../checkout-handoff";

function formatPrice(amount: number, currency: string): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
  });
}

/**
 * Build the Stripe post-payment order-confirmation page (`/checkout/success`).
 *
 * Stripe returns the buyer here with `?session_id=…`. The order id + access
 * token ride along in the `grove_checkout_handoff` cookie set just before the
 * redirect; we decode it, fetch the order, and render the itemized receipt plus
 * the pay-today (deposit) vs due-at-shipping split. If the cookie is missing
 * (bookmark, refresh, cross-device) we still show a graceful "payment received"
 * confirmation — landing here already means Stripe reported success.
 */
export function createCheckoutSuccessPage({ odoo }: { odoo: OdooClient }) {
  return async function CheckoutSuccessPage({
    searchParams,
  }: {
    searchParams: Promise<{ session_id?: string }>;
  }) {
    const [{ session_id }, cookieStore] = await Promise.all([
      searchParams,
      cookies(),
    ]);
    const handoff = decodeHandoff(cookieStore.get(CHECKOUT_HANDOFF_COOKIE)?.value);

    let order: OrderDetail | null = null;
    if (handoff) {
      try {
        order = await odoo.orders.get(handoff.orderId, handoff.accessToken);
      } catch {
        order = null;
      }
    }

    const currency = order?.currency || handoff?.currency || "USD";
    const dueLater = handoff
      ? Math.max(0, handoff.amountTotal - handoff.amountDueToday)
      : 0;

    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <CheckoutSuccessEffects />
        {order && (
          <PurchaseTracker
            orderName={order.name}
            itemCount={order.lines.reduce((n, l) => n + l.quantity, 0)}
            total={order.amountTotal}
          />
        )}

        <div className="rounded-lg border border-primary/10 p-8 text-center mb-8">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary"
          >
            ✓
          </div>
          <h1 className="text-3xl font-display font-bold text-primary mb-3">
            Payment received
          </h1>
          {order ? (
            <>
              <p className="text-foreground/70 mb-1">Thank you, {order.contactName}.</p>
              <p className="text-foreground/70">
                Order <span className="font-semibold">{order.name}</span> is
                confirmed. A receipt is on its way to{" "}
                <span className="font-medium">{order.contactEmail}</span>.
              </p>
            </>
          ) : (
            <p className="text-foreground/70">
              Your payment went through and your order is confirmed. A receipt is
              on its way to your email. You can close this page.
            </p>
          )}
        </div>

        {handoff?.hasPreorder && (
          <div className="rounded-lg border border-primary/20 bg-secondary/10 p-6 mb-8">
            <h2 className="text-base font-semibold text-primary mb-3">
              What you paid today
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-foreground/80">
                  <span aria-hidden="true">●</span> Paid today (deposit)
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatPrice(handoff.amountDueToday, currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-foreground/70">
                  <span aria-hidden="true">◷</span> Due when your plants ship
                </dt>
                <dd className="tabular-nums">{formatPrice(dueLater, currency)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-foreground/60">
              We charge the balance only when your preorder ships — and we email
              you before we do. Order total{" "}
              {formatPrice(handoff.amountTotal, currency)}.
            </p>
          </div>
        )}

        {order && (
          <div className="rounded-lg border border-primary/10 overflow-hidden">
            <h2 className="text-lg font-semibold p-6 pb-4 border-b border-primary/10">
              Order Summary
            </h2>
            <ul className="divide-y divide-primary/10">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-4 p-4 px-6 text-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-foreground/60 text-xs mt-0.5">
                      {line.quantity} × {formatPrice(line.unitPrice, currency)}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatPrice(line.totalPrice, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="border-t border-primary/10 p-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground/70">Subtotal</dt>
                <dd>{formatPrice(order.amountUntaxed, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground/70">Tax</dt>
                <dd>{formatPrice(order.amountTax, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-primary/10 pt-3 mt-3 font-semibold text-base">
                <dt>Order total</dt>
                <dd>{formatPrice(order.amountTotal, currency)}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/shop">
            <Button variant="primary" size="md">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  };
}
