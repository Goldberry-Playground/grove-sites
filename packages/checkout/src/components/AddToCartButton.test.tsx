// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddToCartButton } from "./AddToCartButton";
import { CartProvider } from "../cart-store";

const baseProps = {
  variantId: 2,
  templateId: 2,
  name: "Honeycrisp Apple Tree (3 gal, Pot)",
  price: 38.0,
  imageUrl: "/web/image/product.product/2/image_128",
  disabled: false,
};

function renderWithCart(ui: React.ReactElement) {
  return render(<CartProvider>{ui}</CartProvider>);
}

describe("<AddToCartButton /> — quantity stepper", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function qtyInput() {
    return screen.getByLabelText("Quantity") as HTMLInputElement;
  }

  it("starts at quantity 1", () => {
    renderWithCart(<AddToCartButton {...baseProps} />);
    expect(qtyInput().value).toBe("1");
  });

  it("plus button increments past 1", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton {...baseProps} />);
    await user.click(screen.getByLabelText("Increase quantity"));
    await user.click(screen.getByLabelText("Increase quantity"));
    expect(qtyInput().value).toBe("3");
  });

  it("minus button is disabled at 1 (never goes below 1)", () => {
    renderWithCart(<AddToCartButton {...baseProps} />);
    const minus = screen.getByLabelText("Decrease quantity");
    expect(minus.hasAttribute("disabled")).toBe(true);
    expect(qtyInput().value).toBe("1");
  });

  it("accepts a typed quantity", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton {...baseProps} />);
    const input = qtyInput();
    await user.clear(input);
    await user.type(input, "12");
    expect(input.value).toBe("12");
  });

  it("clamps a non-integer / empty entry back to a valid quantity on blur", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton {...baseProps} />);
    const input = qtyInput();
    await user.clear(input);
    await user.tab(); // blur an empty field
    expect(input.value).toBe("1");
    // A non-integer text entry never sticks either.
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();
    expect(input.value).toBe("1");
  });
});

describe("<AddToCartButton /> — feedback state machine", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows 'Add to Cart' label by default", () => {
    renderWithCart(<AddToCartButton {...baseProps} />);
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDefined();
  });

  it("respects the disabled prop", () => {
    renderWithCart(<AddToCartButton {...baseProps} disabled={true} />);
    const cta = screen.getByRole("button", { name: /add to cart/i });
    expect(cta.hasAttribute("disabled")).toBe(true);
  });

  it("flips to 'Added!' on click", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(screen.getByRole("button", { name: /added!/i })).toBeDefined();
  });

  // Use fireEvent (synchronous, no microtask scheduling) when combining
  // with fake timers — userEvent's internal queue gets tangled with
  // vi.useFakeTimers because it relies on real Promise microtasks.
  it("reverts to 'Add to Cart' after the 1800ms feedback window", () => {
    vi.useFakeTimers();
    try {
      renderWithCart(<AddToCartButton {...baseProps} />);

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
      });
      expect(screen.getByRole("button", { name: /added!/i })).toBeDefined();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole("button", { name: /add to cart/i })).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
