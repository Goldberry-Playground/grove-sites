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
   * shipping / tax = the fee lines; discount = a promo reward (negative
   * `unitAmount`). Drives the ship/reserve badge. */
  kind: "goods" | "deposit" | "shipping" | "tax" | "discount";
  /** Per-unit amount charged today (negative for a discount); the component
   * multiplies by quantity. */
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
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
  });
  // A true minus sign (U+2212), not a hyphen, for the discount row.
  return amount < 0 ? `\u2212${formatted}` : formatted;
}

/** Canonical summary order (Josh, 2026-09-22 — GOL-2432/2450): goods (or the
 *  deposit), then ONE Discount line, then Shipping, then tax. */
const KIND_ORDER: Record<CheckoutReviewItemizedLine["kind"], number> = {
  goods: 0,
  deposit: 0,
  discount: 1,
  shipping: 2,
  tax: 3,
};

interface SummaryLine extends CheckoutReviewItemizedLine {
  /** Secondary text under the row label (the code / tier behind a discount). */
  detail?: string;
}

/**
 * Put the session lines in the canonical order and fold any discount lines
 * into the single pre-tax "Discount" row. The backend (GOL-2450) already sends
 * one discount line in this order; folding + sorting here keeps the summary
 * right against an older build that split the reward per tax group. Amounts are
 * the backend's, only re-labelled and re-ordered: no tax math happens here.
 */
function toSummaryLines(lines: CheckoutReviewItemizedLine[]): SummaryLine[] {
  const discounts = lines.filter((l) => l.kind === "discount");
  const rest: SummaryLine[] = lines.filter((l) => l.kind !== "discount");
  if (discounts.length > 0) {
    const names = [...new Set(discounts.map((l) => l.name.trim()))];
    const only = names.length === 1 ? names[0] : "";
    // "Discount (FLATWOODS)" is already the row label; anything else
    // ("Volume discount 10%") rides as detail under a plain "Discount".
    const named = /^discount\b/i.test(only);
    rest.push({
      name: named ? only : "Discount",
      kind: "discount",
      unitAmount: discounts.reduce((n, l) => n + l.unitAmount * l.quantity, 0),
      quantity: 1,
      detail: named || !only ? undefined : only,
    });
  }
  // Array.prototype.sort is stable, so goods keep their session order.
  return rest
    .map((l) => (l.kind === "shipping" ? { ...l, name: "Shipping" } : l))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
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
  // A promo discount is a fee-style line (negative amount, no ship/reserve
  // badge) — rendered like shipping/tax.
  discount: null,
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
  const itemized =
    lineItems && lineItems.length > 0 ? toSummaryLines(lineItems) : null;
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
              // Ship/reserve badges only mean something when a deposit line
              // sits beside goods; a ships-now summary reads clean (GOL-2432).
              const badge = hasPreorder ? KIND_BADGE[line.kind] : null;
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
                    {line.detail && (
                      <span className="grove-review__line-detail">
                        {line.detail}
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
        {!hasPreorder && (
          <li className="grove-review__total">
            <span>Total due today</span>
            <span>{formatPrice(amountDueToday, currency)}</span>
          </li>
        )}
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
        // Ships-now: the emphasised "Total due today" row closes the line list
        // above (goods, Discount, Shipping, tax, total — GOL-2432 ruling).
        <p className="grove-review__split-note grove-review__total-note">
          You pay this once on the next screen. Nothing is stored on our
          servers.
        </p>
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
