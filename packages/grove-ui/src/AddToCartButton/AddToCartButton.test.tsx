// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AddToCartButton } from "./index";

// Tests the presentational kit component directly (spy on onAddToCart) so we can
// prove exactly which quantity the typed input hands off to the cart (GOL-1055).

function qtyInput() {
  return screen.getByLabelText("Quantity") as HTMLInputElement;
}

describe("<AddToCartButton /> kit — typed quantity input", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the quantity as an editable number input", () => {
    render(<AddToCartButton onAddToCart={() => {}} />);
    const input = qtyInput();
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("number");
    expect(input.value).toBe("1");
  });

  it("adds the typed quantity to the cart", async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    render(<AddToCartButton onAddToCart={onAddToCart} />);
    await user.clear(qtyInput());
    await user.type(qtyInput(), "7");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledWith(7);
  });

  it("never hands a NaN or a fractional quantity to the cart", async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    render(<AddToCartButton onAddToCart={onAddToCart} />);
    // Type a fractional value; parseInt floors it, so the committed value is 2.
    await user.clear(qtyInput());
    await user.type(qtyInput(), "2.9");
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    const added = onAddToCart.mock.calls[0][0];
    expect(Number.isInteger(added)).toBe(true);
    expect(added).toBeGreaterThanOrEqual(1);
    expect(added).toBe(2);
  });

  it("clamps an emptied field back to 1 on blur (no NaN persists)", async () => {
    const user = userEvent.setup();
    render(<AddToCartButton onAddToCart={() => {}} />);
    await user.clear(qtyInput());
    await user.tab();
    expect(qtyInput().value).toBe("1");
  });

  it("supports a controlled quantity (for the sticky-bar lift)", async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(
      <AddToCartButton
        onAddToCart={() => {}}
        quantity={3}
        onQuantityChange={onQuantityChange}
      />,
    );
    expect(qtyInput().value).toBe("3");
    await user.click(screen.getByLabelText("Increase quantity"));
    expect(onQuantityChange).toHaveBeenCalledWith(4);
  });
});
