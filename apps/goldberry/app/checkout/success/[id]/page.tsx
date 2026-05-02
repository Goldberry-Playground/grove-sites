import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@grove/ui";
import { odoo } from "../../../../lib/clients";

export const metadata = { title: "Order Confirmed — Goldberry Grove Farm" };
export const dynamic = "force-dynamic";

function formatPrice(amount: number, currency: string): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
  });
}

export default async function OrderSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  const orderId = Number(id);

  if (Number.isNaN(orderId) || !token) {
    notFound();
  }

  let order;
  try {
    order = await odoo.orders.get(orderId, token);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-lg border border-primary/10 p-8 text-center mb-8">
        <h1 className="text-3xl font-display font-bold text-primary mb-3">
          Order Confirmed
        </h1>
        <p className="text-foreground/70 mb-1">
          Thank you, {order.contactName}.
        </p>
        <p className="text-foreground/70">
          Order <span className="font-semibold">{order.name}</span> is being
          processed. We&apos;ll email{" "}
          <span className="font-medium">{order.contactEmail}</span> with payment
          and pickup details.
        </p>
      </div>

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
                  {line.quantity} × {formatPrice(line.unitPrice, order.currency)}
                </p>
              </div>
              <span className="font-semibold">
                {formatPrice(line.totalPrice, order.currency)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="border-t border-primary/10 p-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-foreground/70">Subtotal</dt>
            <dd>{formatPrice(order.amountUntaxed, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-foreground/70">Tax</dt>
            <dd>{formatPrice(order.amountTax, order.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-primary/10 pt-3 mt-3 font-semibold text-base">
            <dt>Total</dt>
            <dd>{formatPrice(order.amountTotal, order.currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 text-center">
        <Link href="/shop">
          <Button variant="primary" size="md">
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
