"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@grove/ui";
import { useCart } from "../../../lib/cart-store";

type AddToCartButtonProps = {
  variantId: number;
  templateId: number;
  name: string;
  price: number;
  imageUrl: string;
  disabled: boolean;
};

export function AddToCartButton({
  variantId,
  templateId,
  name,
  price,
  imageUrl,
  disabled,
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<"idle" | "added">("idle");
  const { add } = useCart();
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending feedback timer if the component unmounts mid-flash —
  // otherwise React warns about state updates on an unmounted component.
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  function handleAddToCart() {
    add({ variantId, templateId, name, price, imageUrl }, quantity);
    setFeedback("added");
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback("idle"), 1800);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center border border-primary/20 rounded">
        <button
          className="px-3 py-2 text-foreground/60 hover:text-foreground transition-colors"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
        >
          &minus;
        </button>
        <span className="px-3 py-2 text-sm font-medium min-w-[2rem] text-center">
          {quantity}
        </span>
        <button
          className="px-3 py-2 text-foreground/60 hover:text-foreground transition-colors"
          onClick={() => setQuantity((q) => q + 1)}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleAddToCart}
        disabled={disabled}
      >
        {feedback === "added" ? "Added!" : "Add to Cart"}
      </Button>
    </div>
  );
}
