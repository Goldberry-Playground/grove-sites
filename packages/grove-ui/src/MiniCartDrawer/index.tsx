import { useEffect } from "react";

import type { GroveCartLineItem } from "../cart-contract";
import { useGroveImage, useGroveLink } from "../link-context";

export interface MiniCartDrawerProps {
  /** Whether the drawer is mounted/visible. App passes false during SSR. */
  open: boolean;
  /** Current cart lines. */
  items: GroveCartLineItem[];
  /** Cart subtotal. */
  subtotal: number;
  /** Total item count (for the "N items" line). */
  totalQuantity: number;
  /** variantId most recently added — highlighted with a "Just added" tag. */
  lastAddedVariantId?: number | null;
  /** Close the drawer. */
  onClose: () => void;
  /** Full-cart route. */
  cartHref?: string;
  /** Checkout route. */
  checkoutHref?: string;
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Mini-cart drawer — slides in after an add to confirm what landed in the cart.
 *
 * Presentational: `open`, `items`, and totals arrive as props; closing is a
 * callback; Link/Image come from the Grove seam — no store, no `next/*`. Body
 * scroll-lock and Escape-to-close are DOM behavior and stay. Styled against
 * `--grove-*` (see MiniCartDrawer.css).
 *
 * A11y: role="dialog" + aria-modal, Escape closes, backdrop click closes,
 * body scroll locked while open.
 */
export function MiniCartDrawer({
  open,
  items,
  subtotal,
  totalQuantity,
  lastAddedVariantId = null,
  onClose,
  cartHref = "/cart",
  checkoutHref = "/checkout",
}: MiniCartDrawerProps) {
  const Link = useGroveLink();
  const Image = useGroveImage();

  // Body scroll lock while open.
  useEffect(() => {
    if (typeof document === "undefined" || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const justAdded =
    lastAddedVariantId !== null
      ? items.find((i) => i.variantId === lastAddedVariantId)
      : null;
  const otherItems = items.filter((i) => i.variantId !== lastAddedVariantId);

  return (
    <div className="grove-minicart" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="grove-minicart-title"
        onClick={(e) => e.stopPropagation()}
        className="grove-minicart__panel"
      >
        <header className="grove-minicart__header">
          <h2 id="grove-minicart-title" className="grove-minicart__title">
            {justAdded ? "Added to your cart" : "Your cart"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart preview"
            className="grove-minicart__close"
          >
            ×
          </button>
        </header>

        <div className="grove-minicart__body">
          {items.length === 0 ? (
            <p className="grove-minicart__empty">Your cart is empty.</p>
          ) : (
            <>
              {justAdded && (
                <article className="grove-minicart__just-added" aria-label="Just added">
                  {justAdded.imageUrl && (
                    <Image
                      src={justAdded.imageUrl}
                      alt=""
                      className="grove-minicart__ja-img"
                    />
                  )}
                  <div className="grove-minicart__ja-meta">
                    <div className="grove-minicart__ja-tag">Just added</div>
                    <div className="grove-minicart__ja-name">{justAdded.name}</div>
                    <div className="grove-minicart__ja-line">
                      Qty {justAdded.quantity} ·{" "}
                      {formatPrice(justAdded.price * justAdded.quantity)}
                    </div>
                  </div>
                </article>
              )}

              {otherItems.length > 0 && (
                <div>
                  <div className="grove-minicart__section-label">Also in your cart</div>
                  <ul className="grove-minicart__list">
                    {otherItems.map((item) => (
                      <li key={item.variantId} className="grove-minicart__row">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            className="grove-minicart__row-img"
                          />
                        )}
                        <div className="grove-minicart__row-meta">
                          <div className="grove-minicart__row-name">{item.name}</div>
                          <div className="grove-minicart__row-line">
                            Qty {item.quantity} ·{" "}
                            {formatPrice(item.price * item.quantity)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <footer className="grove-minicart__footer">
            <div className="grove-minicart__subtotal">
              <span className="grove-minicart__subtotal-label">
                Subtotal · {totalQuantity} {totalQuantity === 1 ? "item" : "items"}
              </span>
              <span className="grove-minicart__subtotal-amount">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="grove-minicart__ctas">
              <button
                type="button"
                onClick={onClose}
                className="grove-minicart__keep"
              >
                Keep shopping
              </button>
              <Link
                href={checkoutHref}
                className="grove-minicart__checkout"
              >
                Checkout →
              </Link>
            </div>
            <Link href={cartHref} className="grove-minicart__view-cart">
              View full cart
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
