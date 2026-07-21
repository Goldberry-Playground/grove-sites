import { useEffect, useState } from "react";

import { useGroveImage } from "../link-context";

export interface StickyAddToCartBarProps {
  /** Product name shown beside the thumbnail. */
  name: string;
  /** Unit price. */
  price: number;
  /** Fully-resolved thumbnail URL (optional). */
  imageUrl?: string;
  /** Sold-out / unavailable. */
  disabled?: boolean;
  /** Idle CTA label (e.g. "Reserve" for preorder formats). Defaults to "Add to Cart". */
  idleLabel?: string;
  /**
   * Item count for the cart badge. The app passes its cart total (0 during SSR /
   * before hydration so the badge stays hidden until the count is real).
   */
  cartQuantity?: number;
  /** Fired when the user taps Add. The app performs the cart mutation. */
  onAdd: () => void;
  /**
   * CSS selector of the inline Add-to-Cart region on the same page. The bar
   * hides while that region is in view and slides in once it scrolls away.
   */
  anchorSelector?: string;
}

/**
 * Mobile-only sticky add-to-cart bar (CSS-hidden ≥640px). Reveals itself once
 * the inline Add-to-Cart anchor scrolls out of view, so the purchase action is
 * always reachable on long product pages.
 *
 * Presentational: product fields and the cart badge count arrive as props, the
 * add is a callback, and the thumbnail uses the Grove Image seam — no store, no
 * `next/*`. The IntersectionObserver is DOM behavior, not cart state, so it
 * stays. Styled against `--grove-*` (see StickyAddToCartBar.css).
 */
export function StickyAddToCartBar({
  name,
  price,
  imageUrl,
  disabled = false,
  idleLabel = "Add to Cart",
  cartQuantity = 0,
  onAdd,
  anchorSelector = "[data-add-to-cart-anchor]",
}: StickyAddToCartBarProps) {
  const Image = useGroveImage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const anchor = document.querySelector(anchorSelector);
    // No anchor on the page — keep the bar hidden rather than pinning it forever.
    if (!anchor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(!entry.isIntersecting);
      },
      // threshold 0 = any pixel visible; -64px top buffer hides just before the
      // inline button is fully gone, avoiding a flash near the boundary.
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorSelector]);

  function handleAdd() {
    if (disabled) return;
    onAdd();
  }

  return (
    <div
      className={`grove-sticky-atc${visible ? " grove-sticky-atc--visible" : ""}`}
      aria-hidden={!visible}
    >
      <div className="grove-sticky-atc__inner">
        {imageUrl && (
          <Image src={imageUrl} alt="" className="grove-sticky-atc__thumb" />
        )}
        <div className="grove-sticky-atc__meta">
          <div className="grove-sticky-atc__name">{name}</div>
          <div className="grove-sticky-atc__price">${price.toFixed(2)}</div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="grove-sticky-atc__btn"
          aria-label={disabled ? "Sold out" : `${idleLabel}: ${name}`}
        >
          {disabled ? "Sold out" : idleLabel}
          {cartQuantity > 0 && (
            <span className="grove-sticky-atc__badge">
              {cartQuantity}
              <span className="sr-only"> items in cart</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
