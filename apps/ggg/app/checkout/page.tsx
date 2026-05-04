"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@grove/ui";
import { useCart } from "../../lib/cart-store";

const PAYMENT_METHODS = [
  { value: "card", label: "Card (we'll contact you to process)" },
  { value: "check", label: "Check (mail to nursery)" },
  { value: "cash", label: "Cash on pickup" },
  { value: "invoice", label: "Invoice — Net 30 (wholesale only)" },
] as const;

const TAX_RATE_ESTIMATE = 0.07;

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, hydrated, subtotal, clear } = useCart();

  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [shipping, setShipping] = useState({
    street: "",
    street2: "",
    city: "",
    state: "WV",
    zip: "",
    country: "US",
  });
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PAYMENT_METHODS[0].value
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-primary mb-8">
          Checkout
        </h1>
        <p className="text-foreground/50 text-sm">Loading...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-display font-bold text-primary mb-8">
          Checkout
        </h1>
        <div className="rounded-lg border border-primary/10 p-12 text-center">
          <p className="text-foreground/60 mb-6 text-lg">
            Your cart is empty. Add something before checking out.
          </p>
          <Link href="/shop">
            <Button variant="primary" size="md">
              Browse the Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const taxEstimate = subtotal * TAX_RATE_ESTIMATE;
  const total = subtotal + taxEstimate;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          shipping,
          billing: null,
          paymentMethod,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to place order");
      }

      clear();
      const params = new URLSearchParams({ token: data.accessToken });
      router.push(`/checkout/success/${data.id}?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-display font-bold text-primary mb-8">
        Checkout
      </h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-8">
          {/* Contact */}
          <fieldset className="rounded-lg border border-primary/10 p-6">
            <legend className="px-2 text-lg font-semibold">Contact</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <Input
                label="Full name"
                required
                value={contact.name}
                onChange={(v) => setContact({ ...contact, name: v })}
                autoComplete="name"
              />
              <Input
                label="Email"
                type="email"
                required
                value={contact.email}
                onChange={(v) => setContact({ ...contact, email: v })}
                autoComplete="email"
              />
              <Input
                label="Phone"
                type="tel"
                value={contact.phone}
                onChange={(v) => setContact({ ...contact, phone: v })}
                autoComplete="tel"
                className="sm:col-span-2"
              />
            </div>
          </fieldset>

          {/* Shipping */}
          <fieldset className="rounded-lg border border-primary/10 p-6">
            <legend className="px-2 text-lg font-semibold">
              Shipping Address
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <Input
                label="Street"
                required
                value={shipping.street}
                onChange={(v) => setShipping({ ...shipping, street: v })}
                autoComplete="address-line1"
                className="sm:col-span-2"
              />
              <Input
                label="Apt / Suite (optional)"
                value={shipping.street2}
                onChange={(v) => setShipping({ ...shipping, street2: v })}
                autoComplete="address-line2"
                className="sm:col-span-2"
              />
              <Input
                label="City"
                required
                value={shipping.city}
                onChange={(v) => setShipping({ ...shipping, city: v })}
                autoComplete="address-level2"
              />
              <Input
                label="State"
                required
                value={shipping.state}
                onChange={(v) =>
                  setShipping({ ...shipping, state: v.toUpperCase() })
                }
                autoComplete="address-level1"
                maxLength={2}
              />
              <Input
                label="ZIP"
                required
                value={shipping.zip}
                onChange={(v) => setShipping({ ...shipping, zip: v })}
                autoComplete="postal-code"
              />
              <Input
                label="Country"
                required
                value={shipping.country}
                onChange={(v) =>
                  setShipping({ ...shipping, country: v.toUpperCase() })
                }
                autoComplete="country"
                maxLength={2}
              />
            </div>
          </fieldset>

          {/* Payment */}
          <fieldset className="rounded-lg border border-primary/10 p-6">
            <legend className="px-2 text-lg font-semibold">
              Payment Method
            </legend>
            <div className="space-y-2 mt-2">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.value}
                  className="flex items-center gap-3 rounded border border-primary/10 px-4 py-3 cursor-pointer hover:border-primary/30 transition-colors"
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                  />
                  <span className="text-sm">{method.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-foreground/50 mt-3">
              Payment is collected after order confirmation. We&apos;ll contact
              you with details.
            </p>
          </fieldset>
        </div>

        {/* Order summary */}
        <aside className="rounded-lg border border-primary/10 p-6 h-fit lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold mb-4">Your Order</h2>

          <ul className="space-y-2 text-sm mb-4">
            {items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-4">
                <span className="flex-1">
                  {item.name}
                  <span className="text-foreground/50"> × {item.quantity}</span>
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 text-sm border-t border-primary/10 pt-3">
            <div className="flex justify-between">
              <dt className="text-foreground/70">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/70">Tax (estimated)</dt>
              <dd>{formatPrice(taxEstimate)}</dd>
            </div>
            <div className="flex justify-between border-t border-primary/10 pt-3 mt-3 font-semibold text-base">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-6"
            disabled={submitting}
          >
            {submitting ? "Placing Order..." : "Place Order"}
          </Button>

          <Link
            href="/cart"
            className="mt-3 block text-center text-sm text-foreground/60 hover:text-primary transition-colors"
          >
            Back to Cart
          </Link>
        </aside>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  className = "",
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "className"
>) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="block text-foreground/70 mb-1">
        {label}
        {rest.required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-primary/20 px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
      />
    </label>
  );
}
