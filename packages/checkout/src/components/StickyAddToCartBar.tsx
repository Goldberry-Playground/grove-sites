"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "../cart-store";

type StickyAddToCartBarProps = {
  variantId: number;
  templateId: number;
  name: string;
  price: number;
  imageUrl: string;
  disabled?: boolean;
  /**
   * CSS selector of the original AddToCartButton on the same page. When the
   * original scrolls out of view, the sticky bar appears. Defaults to looking
   * for `[data-add-to-cart-anchor]` so consumers can mark their primary
   * Add-to-Cart region with `<div data-add-to-cart-anchor>...</div>` around
   * the inline button.
   */
  anchorSelector?: string;
};

/**
 * Sticky add-to-cart bar — only renders on mobile (CSS-hidden on >=sm).
 *
 * Hides while the original inline Add-to-Cart button is in view; reveals
 * itself once that anchor scrolls out of the viewport. Always-reachable
 * purchase entry on mobile product detail pages, where the primary button
 * sits high on the page and disappears as the user reads the description.
 *
 * Tracks the inline button via IntersectionObserver on a marker element
 * (data-add-to-cart-anchor by default) so we don't have to recompute scroll
 * positions on every frame.
 *
 * Reads cart state via useCart() to optionally show the cart-icon-with-count.
 */
export function StickyAddToCartBar({
  variantId,
  templateId,
  name,
  price,
  imageUrl,
  disabled,
  anchorSelector = "[data-add-to-cart-anchor]",
}: StickyAddToCartBarProps) {
  const { add, openDrawer, totalQuantity, hydrated } = useCart();
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const anchor = document.querySelector(anchorSelector);
    if (!anchor) {
      // No anchor on the page — keep the bar hidden. Better to disappear
      // than to overlap the page bottom indefinitely.
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // entries[0].isIntersecting == true means the original button is
        // visible in viewport — hide the sticky. Otherwise show it.
        for (const entry of entries) {
          setVisible(!entry.isIntersecting);
        }
      },
      {
        // root: viewport. threshold 0 = any pixel of the anchor visible.
        threshold: 0,
        // Add a 64-px buffer at the top so we hide a bit before the original
        // is technically off-screen (avoids a flash near the boundary).
        rootMargin: "-64px 0px 0px 0px",
      },
    );
    observer.observe(anchor);
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [anchorSelector]);

  function handleAdd() {
    if (disabled) return;
    add({ variantId, templateId, name, price, imageUrl }, 1);
    openDrawer(variantId);
  }

  return (
    <div
      // sm:hidden means hide at >=640px — desktop never sees this.
      // Translates off-screen when not visible for smooth slide-in animation.
      className={`fixed left-0 right-0 bottom-0 z-[900] sm:hidden
                  bg-background border-t border-primary/20 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]
                  transition-transform duration-200
                  ${visible ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            className="w-10 h-10 rounded object-cover shrink-0 bg-foreground/5"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-foreground/60 truncate">{name}</div>
          <div className="text-base font-semibold text-primary">
            ${price.toFixed(2)}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="relative px-4 py-2.5 rounded bg-primary text-primary-foreground font-medium text-sm
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:opacity-90 transition-opacity min-w-[7rem]"
          aria-label={disabled ? "Sold out" : `Add ${name} to cart`}
        >
          {disabled ? "Sold out" : "Add to Cart"}
          {hydrated && totalQuantity > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1.5
                         inline-flex items-center justify-center
                         rounded-full bg-accent text-primary text-[10px] font-bold"
              aria-label={`${totalQuantity} items in cart`}
            >
              {totalQuantity}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
