import { Button } from "../Button";

export interface CheckoutReviewLine {
  /** Stable key — the product-variant id. */
  variantId: number;
  name: string;
  quantity: number;
  /** Unit price; the component multiplies by quantity. */
  price: number;
}

/** One itemized charged-today line — the exact breakdown Stripe charges. */
export interface CheckoutReviewItemizedLine {
  name: string;
  /** goods = in-stock unit billed in full; deposit = per-unit preorder deposit;
   * shipping / tax = the fee lines. Drives the ship/reserve badge. */
  kind: "goods" | "deposit" | "shipping" | "tax";
  /** Per-unit amount charged today; the component multiplies by quantity. */
  unitAmount: number;
  quantity: number;
}

export interface CheckoutReviewProps {
  /** Order lines, for a last-look before payment. */
  items: CheckoutReviewLine[];
  /**
   * Authoritative charged-today breakdown from the checkout session — the SAME
   * array Stripe renders (goods / per-unit deposit / shipping / WV tax). When
   * present, the review lists these (with ship/reserve badges) so its math is
   * byte-identical to the card page and the confirmation. Omitted by an Odoo
   * build predating GOL-1057 — the review then falls back to `items`.
   */
  lineItems?: CheckoutReviewItemizedLine[];
  /** Charged today: deposits + in-stock goods + shipping + tax on those. */
  amountDueToday: number;
  /** Full order value; `amountTotal - amountDueToday` is due at ship time. */
  amountTotal: number;
  /** True when the cart contains a preorder line paid by deposit. */
  hasPreorder: boolean;
  /** ISO currency code (defaults to USD). */
  currency?: string;
  /** True while the browser is being redirected to Stripe. */
  redirecting?: boolean;
  /** An error to surface inline (e.g. the session could not be created). */
  error?: string | null;
  /** Proceed to Stripe (the app calls `window.location.assign(checkoutUrl)`). */
  onPay: () => void;
  /** Return to the checkout form to edit contact/shipping. */
  onBack: () => void;
}

function formatPrice(amount: number, currency: string): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
  });
}

/**
 * Order review + payment hand-off. Shown between the checkout form and the
 * Stripe redirect so the buyer sees exactly what is charged *today* (deposit +
 * in-stock goods + shipping/tax) versus what is due when preorders ship — no
 * surprise at the card page. Presentational: the app owns the session call and
 * the redirect. The pay-today / due-later split never signals by color alone —
 * each amount carries a label + icon and the "due later" line is described in
 * words, so it reads in grayscale and for color-blind buyers.
 */
/** Short ship/reserve badge for an itemized line, or null for fee lines. */
const KIND_BADGE: Record<
  CheckoutReviewItemizedLine["kind"],
  { label: string; modifier: string } | null
> = {
  goods: { label: "Ships now", modifier: "ship" },
  deposit: { label: "Reserve", modifier: "reserve" },
  shipping: null,
  tax: null,
};

export function CheckoutReview({
  items,
  lineItems,
  amountDueToday,
  amountTotal,
  hasPreorder,
  currency = "USD",
  redirecting = false,
  error = null,
  onPay,
  onBack,
}: CheckoutReviewProps) {
  const dueLater = Math.max(0, amountTotal - amountDueToday);
  const itemized = lineItems && lineItems.length > 0 ? lineItems : null;
  const totalQuantity = items.reduce((n, it) => n + it.quantity, 0);

  return (
    <div className="grove-review">
      <div className="grove-review__head">
        <h1 className="grove-review__title">Review &amp; pay</h1>
        <p className="grove-review__sub">
          {totalQuantity} {totalQuantity === 1 ? "item" : "items"} · confirm your
          order before you enter card details on our secure Stripe page.
        </p>
      </div>

      <ul className="grove-review__lines">
        {itemized
          ? itemized.map((line, i) => {
              const badge = KIND_BADGE[line.kind];
              return (
                <li
                  key={`${line.kind}-${line.name}-${i}`}
                  className={`grove-review__line${
                    badge ? "" : " grove-review__line--fee"
                  }`}
                >
                  <span className="grove-review__line-name">
                    {line.name}
                    {line.quantity > 1 && (
                      <span className="grove-review__line-qty">
                        {" "}
                        × {line.quantity}
                      </span>
                    )}
                    {badge && (
                      <span
                        className={`grove-review__badge grove-review__badge--${badge.modifier}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </span>
                  <span className="grove-review__line-price">
                    {formatPrice(line.unitAmount * line.quantity, currency)}
                  </span>
                </li>
              );
            })
          : items.map((item) => (
              <li key={item.variantId} className="grove-review__line">
                <span className="grove-review__line-name">
                  {item.name}
                  <span className="grove-review__line-qty"> × {item.quantity}</span>
                </span>
                <span className="grove-review__line-price">
                  {formatPrice(item.price * item.quantity, currency)}
                </span>
              </li>
            ))}
      </ul>

      {hasPreorder ? (
        <div className="grove-review__split">
          <div className="grove-review__amount grove-review__amount--today">
            <div className="grove-review__amount-label">
              <span aria-hidden="true" className="grove-review__amount-icon">
                ●
              </span>
              Due today <span className="grove-review__amount-tag">deposit</span>
            </div>
            <div className="grove-review__amount-value">
              {formatPrice(amountDueToday, currency)}
            </div>
          </div>
          <div className="grove-review__amount grove-review__amount--later">
            <div className="grove-review__amount-label">
              <span aria-hidden="true" className="grove-review__amount-icon">
                ◷
              </span>
              Due when it ships
            </div>
            <div className="grove-review__amount-value">
              {formatPrice(dueLater, currency)}
            </div>
          </div>
          <p className="grove-review__split-note">
            Your card is charged{" "}
            <strong>{formatPrice(amountDueToday, currency)}</strong> today to
            reserve preorder stock. The remaining{" "}
            <strong>{formatPrice(dueLater, currency)}</strong> is charged only
            when your plants ship — we email you first. Order total{" "}
            {formatPrice(amountTotal, currency)}.
          </p>
        </div>
      ) : (
        <div className="grove-review__split">
          <div className="grove-review__amount grove-review__amount--today grove-review__amount--sole">
            <div className="grove-review__amount-label">
              <span aria-hidden="true" className="grove-review__amount-icon">
                ●
              </span>
              Total due today
            </div>
            <div className="grove-review__amount-value">
              {formatPrice(amountDueToday, currency)}
            </div>
          </div>
          <p className="grove-review__split-note">
            Includes any shipping and sales tax. You pay this once on the next screen —
            nothing is stored on our servers.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="grove-review__error">
          <span aria-hidden="true" className="grove-review__error-icon">
            ⚠
          </span>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onPay}
        disabled={redirecting}
        className="grove-review__pay"
      >
        {redirecting
          ? "Redirecting to secure checkout…"
          : `Pay ${formatPrice(amountDueToday, currency)} with card →`}
      </button>

      <p className="grove-review__reassure">
        <span aria-hidden="true">✦</span> Card details are entered on Stripe&apos;s
        secure page — we never see or store your card number.
      </p>

      <button
        type="button"
        onClick={onBack}
        disabled={redirecting}
        className="grove-review__back"
      >
        ← Edit contact or shipping
      </button>
    </div>
  );
}
