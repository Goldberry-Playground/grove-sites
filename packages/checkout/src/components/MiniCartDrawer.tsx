"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "../cart-store";

/**
 * Mini-cart drawer — slides in after the user adds an item.
 *
 * Confirms the add by showing:
 *   • The item just added (highlighted, with a "Just added" tag).
 *   • Everything else already in the cart.
 *   • Running subtotal + item count.
 *   • Two CTAs: "Keep shopping" (close) and "Checkout →" (go to /checkout).
 *
 * Mounted once per app inside `<CartProvider>` (typically in layout.tsx).
 * Subscribes to `drawerOpen` from the cart store; AddToCartButton flips it
 * to true after a successful add().
 *
 * Responsive:
 *   • Desktop (>= 640 px / sm): right-edge slide-in drawer, full height.
 *   • Mobile (< 640 px): bottom-sheet, rounded top corners, ~80% height.
 *
 * A11y:
 *   • Overlay traps focus via aria-modal + role="dialog".
 *   • Escape key closes.
 *   • Body scroll-locked while open.
 *   • Hidden during SSR / pre-hydration so server HTML doesn't include
 *     a flash-of-empty-cart panel.
 */
export function MiniCartDrawer() {
  const {
    items,
    hydrated,
    drawerOpen,
    closeDrawer,
    subtotal,
    totalQuantity,
    lastAddedVariantId,
  } = useCart();

  // Body scroll lock while open. Don't lock during SSR — Window is undefined.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (drawerOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [drawerOpen]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  if (!hydrated || !drawerOpen) return null;

  const justAdded =
    lastAddedVariantId !== null
      ? items.find((i) => i.variantId === lastAddedVariantId)
      : null;
  const otherItems = items.filter(
    (i) => i.variantId !== lastAddedVariantId,
  );

  return (
    <div
      // Overlay: full-viewport. Clicking the dim background closes the drawer
      // (separate from clicking inside the panel, which is stop-propagated).
      className="fixed inset-0 z-[1000] flex bg-black/45 backdrop-blur-sm
                 justify-end items-stretch
                 max-sm:items-end max-sm:justify-stretch"
      onClick={closeDrawer}
      role="presentation"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-cart-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-background text-foreground flex flex-col shadow-2xl
                   w-full max-w-md h-full overflow-hidden
                   max-sm:max-w-full max-sm:h-auto max-sm:max-h-[88vh]
                   max-sm:rounded-t-2xl
                   animate-in slide-in-from-right duration-300
                   max-sm:slide-in-from-bottom"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-primary/15 px-5 py-4 shrink-0">
          <h2
            id="mini-cart-title"
            className="font-display text-lg font-semibold text-primary"
          >
            {justAdded ? "Added to your cart" : "Your cart"}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart preview"
            className="text-2xl leading-none text-foreground/50 hover:text-foreground transition-colors px-2 -mr-2"
          >
            ×
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-foreground/60 py-8 text-center">
              Your cart is empty.
            </p>
          ) : (
            <>
              {justAdded && (
                <article
                  className="flex gap-3 p-3 rounded-md border border-secondary/40 bg-secondary/10 mb-4"
                  aria-label="Just added"
                >
                  {justAdded.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={justAdded.imageUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded shrink-0 bg-background"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono uppercase tracking-wider text-accent mb-0.5">
                      Just added
                    </div>
                    <div className="font-medium truncate">
                      {justAdded.name}
                    </div>
                    <div className="text-sm text-foreground/70 mt-1">
                      Qty {justAdded.quantity} · $
                      {(justAdded.price * justAdded.quantity).toFixed(2)}
                    </div>
                  </div>
                </article>
              )}

              {otherItems.length > 0 && (
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-foreground/50 mb-2">
                    Also in your cart
                  </div>
                  <ul className="space-y-3">
                    {otherItems.map((item) => (
                      <li
                        key={item.variantId}
                        className="flex gap-3 items-start"
                      >
                        {item.imageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-12 h-12 object-cover rounded shrink-0 bg-foreground/5"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-foreground/60 mt-0.5">
                            Qty {item.quantity} · $
                            {(item.price * item.quantity).toFixed(2)}
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

        {/* Sticky footer with totals + CTAs */}
        {items.length > 0 && (
          <footer className="border-t border-primary/15 px-5 py-4 shrink-0 bg-background">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-sm text-foreground/70">
                Subtotal · {totalQuantity}{" "}
                {totalQuantity === 1 ? "item" : "items"}
              </span>
              <span className="text-xl font-display font-semibold text-primary">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="flex-1 px-4 py-3 text-sm font-medium border border-primary/30 rounded hover:border-primary transition-colors"
              >
                Keep shopping
              </button>
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="flex-1 px-4 py-3 text-sm font-medium text-center rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Checkout →
              </Link>
            </div>
            <Link
              href="/cart"
              onClick={closeDrawer}
              className="block text-center text-xs font-mono uppercase tracking-wider mt-3 text-foreground/50 hover:text-foreground transition-colors"
            >
              View full cart
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
