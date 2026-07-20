import { useRef, useState } from "react";

import { Button } from "../Button";
import {
  DEFAULT_TAX_RATE_ESTIMATE,
  type GroveCartLineItem,
} from "../cart-contract";
import { useGroveLink } from "../link-context";

export interface GroveCheckoutContact {
  name: string;
  email: string;
  phone: string;
}

export interface GroveCheckoutShipping {
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/** The order the shopper composed — handed to the app's `onPlaceOrder`. */
export interface GroveCheckoutOrder {
  contact: GroveCheckoutContact;
  shipping: GroveCheckoutShipping;
  paymentMethod: string;
}

export interface GroveCheckoutPaymentMethod {
  value: string;
  label: string;
}

const DEFAULT_PAYMENT_METHODS: GroveCheckoutPaymentMethod[] = [
  { value: "card", label: "Card (we'll contact you to process)" },
  { value: "check", label: "Check (mail to nursery)" },
  { value: "cash", label: "Cash on pickup" },
  { value: "invoice", label: "Invoice — Net 30 (wholesale only)" },
];

export interface CheckoutPageProps {
  /** Cart lines being ordered. */
  items: GroveCartLineItem[];
  /** Cart subtotal. */
  subtotal: number;
  /** True while hydrating the cart from storage. */
  loading?: boolean;
  /**
   * Place the order. The app owns the network call, cart-clear, analytics, and
   * navigation on success; throw (or reject) with an Error to surface a message
   * inline. Resolving means success — the app has already navigated away.
   */
  onPlaceOrder: (order: GroveCheckoutOrder) => Promise<void> | void;
  /** On-page tax estimate rate (final tax is server-computed). */
  taxRateEstimate?: number;
  /** Selectable payment methods. */
  paymentMethods?: GroveCheckoutPaymentMethod[];
  /** Hide the on-page payment-method chooser — e.g. when payment is collected
   *  on a hosted provider page (Stripe). `paymentMethods[0]` is still reported
   *  as the order's `paymentMethod`. */
  hidePaymentMethods?: boolean;
  /** Primary submit label (banner + summary button). */
  submitLabel?: string;
  /** Primary submit label while submitting. */
  submitPendingLabel?: string;
  /** Note under the payment section (shown only when methods are visible). */
  paymentNote?: React.ReactNode;
  /** Reassurance line under the summary submit button. */
  reassure?: React.ReactNode;
  /** Trust-strip badges (icon + text; the icon is decorative). */
  trustItems?: { icon: string; text: string }[];
  /** Shop route (empty state). */
  shopHref?: string;
  /** Cart route (back link). */
  cartHref?: string;
}

const DEFAULT_TRUST_ITEMS = [
  { icon: "✦", text: "Secure · we never store card data" },
  { icon: "◐", text: "Email confirmation before charge" },
  { icon: "✓", text: "Satisfaction or refund" },
];

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Checkout page. Presentational: cart lines + subtotal arrive as props, and the
 * order is placed through `onPlaceOrder` — the app owns fetch, cart-clear,
 * analytics, and routing. Contact/shipping/payment form state and the
 * submitting/error UI are local. No store, no `next/*`. Styled against
 * `--grove-*`, with validation/error surfaces on the status tokens.
 */
export function CheckoutPage({
  items,
  subtotal,
  loading = false,
  onPlaceOrder,
  taxRateEstimate = DEFAULT_TAX_RATE_ESTIMATE,
  paymentMethods = DEFAULT_PAYMENT_METHODS,
  hidePaymentMethods = false,
  submitLabel = "Place Order →",
  submitPendingLabel = "Placing Order…",
  paymentNote,
  reassure,
  trustItems = DEFAULT_TRUST_ITEMS,
  shopHref = "/shop",
  cartHref = "/cart",
}: CheckoutPageProps) {
  const Link = useGroveLink();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [contact, setContact] = useState<GroveCheckoutContact>({
    name: "",
    email: "",
    phone: "",
  });
  const [shipping, setShipping] = useState<GroveCheckoutShipping>({
    street: "",
    street2: "",
    city: "",
    state: "WV",
    zip: "",
    country: "US",
  });
  const [paymentMethod, setPaymentMethod] = useState<string>(
    paymentMethods[0]?.value ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="grove-checkout grove-checkout--narrow">
        <h1 className="grove-checkout__title">Checkout</h1>
        <p className="grove-checkout__loading">Loading…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grove-checkout grove-checkout--narrow">
        <h1 className="grove-checkout__title">Checkout</h1>
        <div className="grove-checkout__empty">
          <p className="grove-checkout__empty-text">
            Your cart is empty. Add something before checking out.
          </p>
          <Link href={shopHref} className="grove-checkout__empty-cta">
            <Button variant="primary" size="md">
              Browse the Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const taxEstimate = subtotal * taxRateEstimate;
  const total = subtotal + taxEstimate;
  const totalQuantity = items.reduce((n, it) => n + it.quantity, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onPlaceOrder({ contact, shipping, paymentMethod });
      // On success the app navigates away; keep the button in its submitting
      // state so it doesn't flash back to idle during the route transition.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // The top-banner CTA submits the same form so the bold action stays visible
  // without scrolling to the right-rail button.
  function submitFromTop() {
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <div className="grove-checkout__banner">
        <div className="grove-checkout__banner-inner">
          <div>
            <div className="grove-checkout__banner-eyebrow">
              {totalQuantity} {totalQuantity === 1 ? "item" : "items"} · ready to ship
            </div>
            <div className="grove-checkout__banner-total">
              {formatPrice(total)}
              <span className="grove-checkout__banner-note">with est. tax</span>
            </div>
          </div>
          <button
            type="button"
            onClick={submitFromTop}
            disabled={submitting}
            className="grove-checkout__banner-cta"
          >
            {submitting ? submitPendingLabel : submitLabel}
          </button>
        </div>
      </div>

      <div className="grove-checkout__trust">
        <div className="grove-checkout__trust-inner">
          {trustItems.map((t, i) => (
            <span key={i} className="grove-checkout__trust-item">
              <span aria-hidden="true">{t.icon}</span> {t.text}
            </span>
          ))}
        </div>
      </div>

      <div className="grove-checkout">
        <h1 className="grove-checkout__title">Checkout</h1>

        <form ref={formRef} onSubmit={handleSubmit} className="grove-checkout__grid">
          <div className="grove-checkout__col">
            <fieldset className="grove-checkout__fieldset">
              <legend className="grove-checkout__legend">Contact</legend>
              <div className="grove-checkout__fields">
                <Field
                  label="Full name"
                  required
                  value={contact.name}
                  onChange={(v) => setContact({ ...contact, name: v })}
                  autoComplete="name"
                  span2
                />
                <Field
                  label="Email"
                  type="email"
                  required
                  value={contact.email}
                  onChange={(v) => setContact({ ...contact, email: v })}
                  autoComplete="email"
                />
                <Field
                  label="Phone"
                  type="tel"
                  value={contact.phone}
                  onChange={(v) => setContact({ ...contact, phone: v })}
                  autoComplete="tel"
                />
              </div>
            </fieldset>

            <fieldset className="grove-checkout__fieldset">
              <legend className="grove-checkout__legend">Shipping Address</legend>
              <div className="grove-checkout__fields">
                <Field
                  label="Street"
                  required
                  value={shipping.street}
                  onChange={(v) => setShipping({ ...shipping, street: v })}
                  autoComplete="address-line1"
                  span2
                />
                <Field
                  label="Apt / Suite (optional)"
                  value={shipping.street2}
                  onChange={(v) => setShipping({ ...shipping, street2: v })}
                  autoComplete="address-line2"
                  span2
                />
                <Field
                  label="City"
                  required
                  value={shipping.city}
                  onChange={(v) => setShipping({ ...shipping, city: v })}
                  autoComplete="address-level2"
                />
                <Field
                  label="State"
                  required
                  value={shipping.state}
                  onChange={(v) => setShipping({ ...shipping, state: v.toUpperCase() })}
                  autoComplete="address-level1"
                  maxLength={2}
                />
                <Field
                  label="ZIP"
                  required
                  value={shipping.zip}
                  onChange={(v) => setShipping({ ...shipping, zip: v })}
                  autoComplete="postal-code"
                />
                <Field
                  label="Country"
                  required
                  value={shipping.country}
                  onChange={(v) => setShipping({ ...shipping, country: v.toUpperCase() })}
                  autoComplete="country"
                  maxLength={2}
                />
              </div>
            </fieldset>

            {!hidePaymentMethods && (
              <fieldset className="grove-checkout__fieldset">
                <legend className="grove-checkout__legend">Payment Method</legend>
                <div className="grove-checkout__payments">
                  {paymentMethods.map((method) => (
                    <label key={method.value} className="grove-checkout__payment">
                      <input
                        type="radio"
                        name="payment"
                        value={method.value}
                        checked={paymentMethod === method.value}
                        onChange={() => setPaymentMethod(method.value)}
                      />
                      <span>{method.label}</span>
                    </label>
                  ))}
                </div>
                <p className="grove-checkout__payment-note">
                  {paymentNote ?? (
                    <>
                      Payment is collected after order confirmation. We&apos;ll
                      contact you with details.
                    </>
                  )}
                </p>
              </fieldset>
            )}
          </div>

          <aside className="grove-checkout__summary">
            <h2 className="grove-checkout__summary-title">Your Order</h2>
            <ul className="grove-checkout__order-list">
              {items.map((item) => (
                <li key={item.variantId} className="grove-checkout__order-row">
                  <span className="grove-checkout__order-name">
                    {item.name}
                    <span className="grove-checkout__order-qty"> × {item.quantity}</span>
                  </span>
                  <span>{formatPrice(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <dl className="grove-checkout__summary-list">
              <div className="grove-checkout__summary-row">
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className="grove-checkout__summary-row">
                <dt>Tax (estimated)</dt>
                <dd>{formatPrice(taxEstimate)}</dd>
              </div>
              <div className="grove-checkout__summary-total">
                <dt>Total</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="grove-checkout__error">
                <span aria-hidden="true" className="grove-checkout__error-icon">
                  ⚠
                </span>
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="grove-checkout__submit">
              {submitting ? submitPendingLabel : submitLabel}
            </button>

            <p className="grove-checkout__reassure">
              {reassure ?? (
                <>
                  You will not be charged today. We confirm every order by email
                  before processing payment.
                </>
              )}
            </p>

            <Link href={cartHref} className="grove-checkout__back">
              Back to Cart
            </Link>
          </aside>
        </form>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  span2 = false,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  span2?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className={`grove-checkout__field${span2 ? " grove-checkout__field--span2" : ""}`}>
      <span className="grove-checkout__field-label">
        {label}
        {rest.required && (
          <span className="grove-checkout__required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="grove-checkout__input"
      />
    </label>
  );
}
