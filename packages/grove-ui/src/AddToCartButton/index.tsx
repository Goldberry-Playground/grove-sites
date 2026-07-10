import { useEffect, useRef, useState } from "react";

import { Button } from "../Button";

export interface AddToCartButtonProps {
  /** Sold-out / unavailable — disables the primary action. */
  disabled?: boolean;
  /**
   * Fired with the chosen quantity when the user commits the add. The app wires
   * this to its cart store (add + open mini-cart + analytics) — the button owns
   * none of that, only the quantity stepper and the "Added!" flash.
   */
  onAddToCart: (quantity: number) => void;
  /** Idle button label. */
  idleLabel?: string;
  /** Confirmation label shown briefly after an add. */
  addedLabel?: string;
  /** Starting quantity (min 1). */
  initialQuantity?: number;
}

/**
 * Quantity stepper + Add-to-Cart button. Presentational: quantity and the
 * post-add "Added!" flash are local UI state; the actual cart mutation is the
 * `onAddToCart` callback. No store, no `next/*`, no analytics import — so it
 * lives in the shared kit and themes via `--grove-*` (see AddToCartButton.css).
 */
export function AddToCartButton({
  disabled = false,
  onAddToCart,
  idleLabel = "Add to Cart",
  addedLabel = "Added!",
  initialQuantity = 1,
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(Math.max(1, initialQuantity));
  const [feedback, setFeedback] = useState<"idle" | "added">("idle");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear a pending flash timer on unmount so React doesn't warn about a state
  // update on an unmounted component.
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  function handleAddToCart() {
    onAddToCart(quantity);
    setFeedback("added");
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback("idle"), 1800);
  }

  return (
    <div className="grove-atc">
      <div className="grove-atc__stepper">
        <button
          type="button"
          className="grove-atc__step"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
        >
          &minus;
        </button>
        <span className="grove-atc__qty" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          className="grove-atc__step"
          onClick={() => setQuantity((q) => q + 1)}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <Button variant="primary" size="lg" onClick={handleAddToCart} disabled={disabled}>
        {feedback === "added" ? addedLabel : idleLabel}
      </Button>
    </div>
  );
}
