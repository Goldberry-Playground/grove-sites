import { useEffect, useState } from "react";

import { Button } from "../Button";
import {
  DEFAULT_TAX_RATE_ESTIMATE,
  type GroveCartLineItem,
} from "../cart-contract";
import { useGroveImage, useGroveLink } from "../link-context";
import { clampQuantity } from "../quantity";

export interface CartPageProps {
  /** Cart lines. */
  items: GroveCartLineItem[];
  /** Cart subtotal. */
  subtotal: number;
  /** Total item count. */
  totalQuantity: number;
  /**
   * True while the app is still hydrating the cart from storage. Shows a neutral
   * loading state so server (always empty) and client don't flash-mismatch.
   */
  loading?: boolean;
  /** Change a line's quantity. */
  onSetQuantity: (variantId: number, quantity: number) => void;
  /** Remove a line. */
  onRemove: (variantId: number) => void;
  /** On-page tax estimate rate (final tax is server-computed at checkout). */
  taxRateEstimate?: number;
  /** Shop route (empty state + keep-shopping). */
  shopHref?: string;
  /** Checkout route. */
  checkoutHref?: string;
  /** Build a product-detail href from a template id. */
  productHref?: (templateId: number) => string;
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Full cart page. Presentational: lines + totals arrive as props, quantity and
 * remove are callbacks, Link/Image come from the Grove seam — no store, no
 * `next/*`. Styled against `--grove-*` (see CartPage.css).
 */
export function CartPage({
  items,
  subtotal,
  totalQuantity,
  loading = false,
  onSetQuantity,
  onRemove,
  taxRateEstimate = DEFAULT_TAX_RATE_ESTIMATE,
  shopHref = "/shop",
  checkoutHref = "/checkout",
  productHref = (templateId) => `/shop/${templateId}`,
}: CartPageProps) {
  const Link = useGroveLink();
  const Image = useGroveImage();

  if (loading) {
    return (
      <div className="grove-cart grove-cart--narrow">
        <h1 className="grove-cart__title">Your Cart</h1>
        <p className="grove-cart__loading">Loading cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="grove-cart grove-cart--narrow">
        <h1 className="grove-cart__title">Your Cart</h1>
        <div className="grove-cart__empty">
          <p className="grove-cart__empty-text">Your cart is empty.</p>
          <Link href={shopHref} className="grove-cart__empty-cta">
            <Button variant="primary" size="md">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const taxEstimate = subtotal * taxRateEstimate;
  const total = subtotal + taxEstimate;

  return (
    <>
      {/* Sticky checkout banner — the path to checkout never scrolls away. */}
      <div className="grove-cart__banner">
        <div className="grove-cart__banner-inner">
          <div>
            <div className="grove-cart__banner-eyebrow">
              {totalQuantity} {totalQuantity === 1 ? "item" : "items"} in cart
            </div>
            <div className="grove-cart__banner-total">
              {formatPrice(total)}
              <span className="grove-cart__banner-note">with est. tax</span>
            </div>
          </div>
          <Link href={checkoutHref} className="grove-cart__banner-cta">
            Checkout Now →
          </Link>
        </div>
      </div>

      {/* Trust strip — each signal carries an icon AND text (never color alone). */}
      <div className="grove-cart__trust">
        <div className="grove-cart__trust-inner">
          <span className="grove-cart__trust-item">
            <span aria-hidden="true">✦</span> Ships from our farm
          </span>
          <span className="grove-cart__trust-item">
            <span aria-hidden="true">◐</span> Made by us, on our land
          </span>
          <span className="grove-cart__trust-item">
            <span aria-hidden="true">✓</span> Satisfaction or refund
          </span>
          <span className="grove-cart__trust-item">
            <span aria-hidden="true">♦</span> No payment until we confirm
          </span>
        </div>
      </div>

      <div className="grove-cart">
        <div className="grove-cart__head">
          <h1 className="grove-cart__title">Your Cart</h1>
          <Link href={shopHref} className="grove-cart__keep-link">
            ← Keep shopping
          </Link>
        </div>

        <div className="grove-cart__grid">
          <ul className="grove-cart__lines">
            {items.map((item) => (
              <li key={item.variantId} className="grove-cart__line">
                <div className="grove-cart__line-img">
                  {item.imageUrl && <Image src={item.imageUrl} alt={item.name} />}
                </div>

                <div className="grove-cart__line-body">
                  <div>
                    <Link
                      href={productHref(item.templateId)}
                      className="grove-cart__line-name"
                    >
                      {item.name}
                    </Link>
                    <p className="grove-cart__line-unit">
                      {formatPrice(item.price)} each
                    </p>
                  </div>

                  <div className="grove-cart__line-controls">
                    <CartLineQuantity
                      name={item.name}
                      quantity={item.quantity}
                      onSetQuantity={(q) => onSetQuantity(item.variantId, q)}
                    />

                    <div className="grove-cart__line-right">
                      <span className="grove-cart__line-total">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        type="button"
                        className="grove-cart__remove"
                        onClick={() => onRemove(item.variantId)}
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

          <aside className="grove-cart__summary">
            <h2 className="grove-cart__summary-title">Order Summary</h2>
            <dl className="grove-cart__summary-list">
              <div className="grove-cart__summary-row">
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className="grove-cart__summary-row">
                <dt>
                  Tax (estimated {Math.round(taxRateEstimate * 100)}%)
                  <span className="grove-cart__summary-note">
                    Final tax calculated at checkout
                  </span>
                </dt>
                <dd>{formatPrice(taxEstimate)}</dd>
              </div>
              <div className="grove-cart__summary-total">
                <dt>Total</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            <Link href={checkoutHref} className="grove-cart__summary-cta">
              Proceed to Checkout →
            </Link>

            <p className="grove-cart__reassure">
              You will not be charged today. We confirm every order by email before
              processing payment.
            </p>

            <Link href={shopHref} className="grove-cart__summary-continue">
              Continue Shopping
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}

/**
 * A cart line's quantity control: −/+ steppers plus a real typed number input,
 * so a shopper can set "12" directly. Every commit path runs through
 * `clampQuantity`, so a fractional, NaN, or < 1 value can never reach the store
 * (GOL-1055). The field can be transiently empty while typing; on blur it snaps
 * back to a valid integer. Removal stays the explicit Remove button — an emptied
 * field never silently deletes the line.
 */
function CartLineQuantity({
  name,
  quantity,
  onSetQuantity,
}: {
  name: string;
  quantity: number;
  onSetQuantity: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));

  // Follow the committed quantity when it changes (stepper, or an external
  // update) so the field never disagrees with the line total.
  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  function commit(next: number) {
    const clamped = clampQuantity(next);
    if (clamped !== quantity) onSetQuantity(clamped);
    return clamped;
  }

  return (
    <div className="grove-cart__stepper">
      <button
        type="button"
        className="grove-cart__step"
        onClick={() => commit(quantity - 1)}
        aria-label={`Decrease quantity of ${name}`}
        disabled={quantity <= 1}
      >
        &minus;
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        className="grove-cart__qty"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const parsed = Number.parseInt(raw, 10);
          if (Number.isInteger(parsed) && parsed >= 1) commit(parsed);
        }}
        onBlur={() => setDraft(String(commit(Number.parseInt(draft, 10))))}
        aria-label={`Quantity of ${name}`}
      />
      <button
        type="button"
        className="grove-cart__step"
        onClick={() => commit(quantity + 1)}
        aria-label={`Increase quantity of ${name}`}
      >
        +
      </button>
    </div>
  );
}
