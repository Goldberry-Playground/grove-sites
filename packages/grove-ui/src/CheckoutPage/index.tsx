import { useRef, useState } from "react";

import { Button } from "../Button";
import {
  DEFAULT_TAX_RATE_ESTIMATE,
  type GroveCartLineItem,
} from "../cart-contract";
import { useGroveLink } from "../link-context";
import type { GroveTrustItem } from "../trust-items";

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

/** How the order is handed to the buyer: shipped to their address, or picked up
 *  at the nursery. Pickup is the one legitimate $0-shipping case. */
export type GroveFulfillment = "ship" | "pickup";

/** The order the shopper composed — handed to the app's `onPlaceOrder`. */
export interface GroveCheckoutOrder {
  contact: GroveCheckoutContact;
  shipping: GroveCheckoutShipping;
  paymentMethod: string;
  /** Ship-to-address vs farm pickup. `"ship"` when the pickup option is off. */
  fulfillment: GroveFulfillment;
}

/** A selectable ship-to state or country: 2-letter `code` sent to the server,
 *  human `name` shown in the dropdown. */
export interface GroveShipToOption {
  code: string;
  name: string;
}

/** Fallback country list when the app supplies none. US-only today; a select
 *  (not free text) so `shipping.country` is always a clean code. */
const DEFAULT_COUNTRIES: GroveShipToOption[] = [
  { code: "US", name: "United States" },
];

export interface GroveCheckoutPaymentMethod {
  value: string;
  label: string;
}

/**
 * Brand-NEUTRAL payment labels (GOL-1314). These render on every storefront
 * that doesn't pass `paymentMethods`, so they must describe the mechanism only
 * — never the business. "Check (mail to nursery)" told woodwork and pantry
 * customers to post a cheque to a nursery; a consumer with its own destination
 * supplies its own labels via the `paymentMethods` prop, exactly like the trust
 * strip and pickup copy.
 */
const DEFAULT_PAYMENT_METHODS: GroveCheckoutPaymentMethod[] = [
  { value: "card", label: "Card (we'll contact you to process)" },
  { value: "check", label: "Check (by mail)" },
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
  /**
   * Trust-strip badges (icon + text; the icon is decorative). Defaults to `[]`
   * — the strip is omitted unless a consumer opts in. The presentational kit
   * must never bake a brand claim (e.g. the nursery "arrive-alive guarantee")
   * in as a default: any surface that dropped the prop would silently advertise
   * a promise false for its products. Brand copy is owned per-brand in
   * `@grove/checkout`'s `BRAND_TRUST` (GOL-1090, GOL-1314).
   */
  trustItems?: GroveTrustItem[];
  /** Shop route (empty state). */
  shopHref?: string;
  /** Cart route (back link). */
  cartHref?: string;
  /**
   * Supported ship-to states. When provided, the State field is a `<select>`
   * limited to these codes — an unsupported/free-typed state (the "Ohio" vs
   * "OH" bug class) becomes impossible to submit (GOL-1055). Omit to fall back
   * to a 2-letter free-text field.
   */
  shipStates?: GroveShipToOption[];
  /**
   * Help note under the address when `shipStates` limits the ship-to list.
   * Receives the supported-state count. Defaults to brand-neutral copy — the
   * kit never hardcodes "we ship live trees" (a nursery-only claim that would
   * leak onto woodwork/pantry storefronts); the nursery supplies its own
   * phrasing through the brand layer (GOL-1314).
   */
  shipStatesNote?: (supportedCount: number) => React.ReactNode;
  /** Supported ship-to countries. Rendered as a `<select>` (default: US only). */
  countries?: GroveShipToOption[];
  /**
   * Offer a Ship-to-me vs Farm-pickup choice. When true, a Fulfillment fieldset
   * renders above the address; choosing pickup hides the ship-to fields and
   * relaxes their required state, and the order reports `fulfillment: "pickup"`.
   * Off by default — consumers without a pickup location keep the ship-only form
   * and always report `"ship"`.
   */
  allowPickup?: boolean;
  /**
   * Fulfillment copy for the ship-vs-pickup fieldset (only rendered when
   * `allowPickup`). Defaults are brand-neutral and make no product-specific
   * claim — a pickup-enabled consumer supplies its own truthful copy (the
   * nursery's "collect at our WV nursery" / "live trees … planting window"
   * strings live in `@grove/checkout`'s brand seam, not baked in here so they
   * can never leak onto a non-nursery storefront — GOL-1314).
   */
  pickupCopy?: GrovePickupCopy;
}

/**
 * Copy for the ship-vs-pickup fulfillment fieldset. The presentational kit
 * ships brand-neutral defaults; brand-specific, product-true wording (live
 * trees, a named pickup location, a specific tax jurisdiction) is supplied by
 * the consumer so no claim is ever false-by-default (GOL-1314).
 */
export interface GrovePickupCopy {
  /** Label for the "ship to me" radio. */
  shipLabel: string;
  /** Label for the "pickup" radio. */
  pickupLabel: string;
  /** Note shown when pickup is selected. */
  pickupNote: string;
  /** Note shown when ship is selected. */
  shipNote: string;
}

const DEFAULT_SHIP_STATES_NOTE = (supportedCount: number): React.ReactNode =>
  `We currently ship to ${supportedCount} states. Don't see yours? It's not on our route yet.`;

const DEFAULT_PICKUP_COPY: GrovePickupCopy = {
  shipLabel: "Ship to me — delivered to your address",
  pickupLabel: "Local pickup — collect your order ($0 shipping)",
  pickupNote:
    "Pick up your order — no shipping charge. Local sales tax applies. We'll email you when it's ready.",
  shipNote: "We'll ship your order to the address above.",
};

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
  trustItems = [],
  shopHref = "/shop",
  cartHref = "/cart",
  shipStates,
  shipStatesNote = DEFAULT_SHIP_STATES_NOTE,
  countries = DEFAULT_COUNTRIES,
  allowPickup = false,
  pickupCopy = DEFAULT_PICKUP_COPY,
}: CheckoutPageProps) {
  const Link = useGroveLink();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [fulfillment, setFulfillment] = useState<GroveFulfillment>("ship");
  // Pickup collapses the ship-to address; ship keeps it required.
  const isPickup = allowPickup && fulfillment === "pickup";

  const [contact, setContact] = useState<GroveCheckoutContact>({
    name: "",
    email: "",
    phone: "",
  });
  const [shipping, setShipping] = useState<GroveCheckoutShipping>({
    street: "",
    street2: "",
    city: "",
    // With a state <select>, start unset so the shopper makes an explicit,
    // valid choice (no silent default to WV). Free-text fallback keeps WV.
    state: shipStates ? "" : "WV",
    zip: "",
    country: countries[0]?.code ?? "US",
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
      await onPlaceOrder({ contact, shipping, paymentMethod, fulfillment });
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
              {totalQuantity} {totalQuantity === 1 ? "item" : "items"} ·{" "}
              {isPickup ? "farm pickup" : "ready to ship"}
            </div>
            <div className="grove-checkout__banner-total">
              {formatPrice(total)}
              <span className="grove-checkout__banner-note">
                {isPickup ? "with est. tax" : "before shipping & tax"}
              </span>
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

      {trustItems.length > 0 && (
        <div className="grove-checkout__trust">
          <div className="grove-checkout__trust-inner">
            {trustItems.map((t, i) => (
              <span key={i} className="grove-checkout__trust-item">
                <span aria-hidden="true">{t.icon}</span> {t.text}
              </span>
            ))}
          </div>
        </div>
      )}

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

            {allowPickup && (
              /* Reuses the payment radio-card styles (__payments/__payment) —
                 same visual pattern, no extra CSS against the 6 KB budget. */
              <fieldset className="grove-checkout__fieldset">
                <legend className="grove-checkout__legend">Fulfillment</legend>
                <div
                  className="grove-checkout__payments"
                  role="radiogroup"
                  aria-label="How to receive your order"
                >
                  <label className="grove-checkout__payment">
                    <input
                      type="radio"
                      name="fulfillment"
                      value="ship"
                      checked={fulfillment === "ship"}
                      onChange={() => setFulfillment("ship")}
                    />
                    <span>{pickupCopy.shipLabel}</span>
                  </label>
                  <label className="grove-checkout__payment">
                    <input
                      type="radio"
                      name="fulfillment"
                      value="pickup"
                      checked={fulfillment === "pickup"}
                      onChange={() => setFulfillment("pickup")}
                    />
                    <span>{pickupCopy.pickupLabel}</span>
                  </label>
                </div>
                <p className="grove-checkout__field-note grove-checkout__field-note--block">
                  {isPickup ? pickupCopy.pickupNote : pickupCopy.shipNote}
                </p>
              </fieldset>
            )}

            {!isPickup && (
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
                {shipStates ? (
                  <SelectField
                    label="State"
                    required
                    value={shipping.state}
                    onChange={(v) => setShipping({ ...shipping, state: v })}
                    autoComplete="address-level1"
                    placeholder="Select a state"
                    options={shipStates.map((s) => ({ value: s.code, label: s.name }))}
                  />
                ) : (
                  <Field
                    label="State"
                    required
                    value={shipping.state}
                    onChange={(v) => setShipping({ ...shipping, state: v.toUpperCase() })}
                    autoComplete="address-level1"
                    maxLength={2}
                  />
                )}
                <Field
                  label="ZIP"
                  required
                  value={shipping.zip}
                  onChange={(v) => setShipping({ ...shipping, zip: v })}
                  autoComplete="postal-code"
                />
                <SelectField
                  label="Country"
                  required
                  value={shipping.country}
                  onChange={(v) => setShipping({ ...shipping, country: v })}
                  autoComplete="country"
                  options={countries.map((c) => ({ value: c.code, label: c.name }))}
                />
                {shipStates && (
                  <p className="grove-checkout__field-note grove-checkout__field--span2">
                    {shipStatesNote(shipStates.length)}
                  </p>
                )}
              </div>
            </fieldset>
            )}

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
              {/* Shipping is priced server-side by the box engine once the
                  destination is known, so the form can't show a final figure.
                  We still list the line — a missing shipping row is what made
                  the form's "Total" read below the amount actually charged at
                  the payment step (GOL-1823). Pickup is the one $0-shipping
                  case, so it can be shown as free. */}
              <div className="grove-checkout__summary-row">
                <dt>Shipping</dt>
                <dd>{isPickup ? "Free (pickup)" : "Calculated at payment"}</dd>
              </div>
              <div className="grove-checkout__summary-row">
                <dt>Tax (estimated)</dt>
                <dd>{formatPrice(taxEstimate)}</dd>
              </div>
              <div className="grove-checkout__summary-total">
                <dt>{isPickup ? "Total" : "Estimated total"}</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            {!isPickup && (
              <p className="grove-checkout__field-note grove-checkout__field-note--block">
                Shipping and final sales tax are calculated on the secure
                payment page. You&apos;ll see and confirm the full total before
                you&apos;re charged.
              </p>
            )}

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

/**
 * Constrained field: a `<select>` matched to `Field`'s look. Only listed option
 * values are choosable, so an unsupported/unparseable value can't be submitted.
 * A `placeholder` renders a disabled empty option so `required` forces a real
 * choice when the field starts unset.
 */
function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  span2 = false,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  span2?: boolean;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className={`grove-checkout__field${span2 ? " grove-checkout__field--span2" : ""}`}>
      <span className="grove-checkout__field-label">
        {label}
        {required && (
          <span className="grove-checkout__required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      <select
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="grove-checkout__input grove-checkout__select"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
