import { useEffect, useRef, useState } from "react";

import { Button } from "../Button";
import { clampQuantity } from "../quantity";

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
  /** Starting quantity (min 1). Ignored when `quantity` (controlled) is set. */
  initialQuantity?: number;
  /**
   * Controlled quantity. Pass with `onQuantityChange` to lift the chosen
   * quantity into the page — e.g. so a sticky add-to-cart bar adds the SAME
   * quantity the shopper set here (GOL-1055). Omit both for a self-contained
   * stepper.
   */
  quantity?: number;
  /** Controlled quantity setter; required alongside `quantity`. */
  onQuantityChange?: (quantity: number) => void;
}

/**
 * Quantity stepper + Add-to-Cart button. Presentational: the actual cart
 * mutation is the `onAddToCart` callback (no store, no `next/*`, no analytics),
 * so it lives in the shared kit and themes via `--grove-*` (see
 * AddToCartButton.css).
 *
 * The quantity is a real typed <input type="number">, not just +/- buttons:
 * shoppers can type "12" instead of tapping twelve times. Every path — typing,
 * stepping, blurring an empty field — is funnelled through `clampQuantity`, so a
 * non-integer, a NaN, or a value < 1 can never reach the cart (GOL-1055). The
 * displayed `draft` string can be transiently empty while typing, but the
 * committed quantity is always a clamped positive integer.
 */
export function AddToCartButton({
  disabled = false,
  onAddToCart,
  idleLabel = "Add to Cart",
  addedLabel = "Added!",
  initialQuantity = 1,
  quantity: controlledQuantity,
  onQuantityChange,
}: AddToCartButtonProps) {
  const isControlled = controlledQuantity != null;
  const [internalQuantity, setInternalQuantity] = useState(() =>
    clampQuantity(initialQuantity),
  );
  const quantity = isControlled
    ? clampQuantity(controlledQuantity)
    : internalQuantity;

  // What the input field shows. Kept as a string so the shopper can clear it to
  // retype; the committed `quantity` never follows it into an invalid state.
  const [draft, setDraft] = useState(String(quantity));

  const [feedback, setFeedback] = useState<"idle" | "added">("idle");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror committed quantity into the field when it changes from the outside
  // (the +/- buttons, or a controlled parent) so the two never disagree.
  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  // Clear a pending flash timer on unmount so React doesn't warn about a state
  // update on an unmounted component.
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  function commitQuantity(next: number) {
    const clamped = clampQuantity(next);
    if (isControlled) onQuantityChange?.(clamped);
    else setInternalQuantity(clamped);
    return clamped;
  }

  function handleDraftChange(raw: string) {
    setDraft(raw);
    // Commit only when the field parses to a clean positive integer; otherwise
    // hold the last good quantity and let onBlur normalise. `parseInt` floors
    // "1.5" → 1 and rejects "abc"/"" → NaN.
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1) commitQuantity(parsed);
  }

  function handleDraftBlur() {
    const clamped = commitQuantity(Number.parseInt(draft, 10));
    setDraft(String(clamped));
  }

  function step(delta: number) {
    const clamped = commitQuantity(quantity + delta);
    setDraft(String(clamped));
  }

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
          onClick={() => step(-1)}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
        >
          &minus;
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="grove-atc__qty"
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onBlur={handleDraftBlur}
          aria-label="Quantity"
        />
        <button
          type="button"
          className="grove-atc__step"
          onClick={() => step(1)}
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
