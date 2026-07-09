"use client";

import { trackBeginCheckout } from "@grove/analytics";
import { useRouter } from "next/navigation";
import {
  CheckoutPage as UICheckoutPage,
  type GroveCheckoutOrder,
} from "@grove/ui-kit";
import { useCart } from "../cart-store";
import { WithGroveNext } from "./grove-next-seam";

/**
 * Cart-connected CheckoutPage. The presentational form + summary live in
 * `@grove/ui-kit`; this wrapper owns the app-side concerns the kit must not
 * carry: analytics, the BFF `POST /api/checkout` call, cart-clear, and routing
 * to the order-success page. A thrown Error surfaces inline on the form.
 */
export function CheckoutPage() {
  const router = useRouter();
  const { items, hydrated, subtotal, clear } = useCart();

  async function placeOrder(order: GroveCheckoutOrder) {
    const totalQuantity = items.reduce((n, it) => n + it.quantity, 0);
    trackBeginCheckout({ itemCount: totalQuantity, subtotal });

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: order.contact,
        shipping: order.shipping,
        billing: null,
        paymentMethod: order.paymentMethod,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to place order");
    }

    clear();
    const params = new URLSearchParams({ token: data.accessToken });
    router.push(`/checkout/success/${data.id}?${params.toString()}`);
  }

  return (
    <WithGroveNext>
      <UICheckoutPage
        items={items}
        subtotal={subtotal}
        loading={!hydrated}
        onPlaceOrder={placeOrder}
      />
    </WithGroveNext>
  );
}
