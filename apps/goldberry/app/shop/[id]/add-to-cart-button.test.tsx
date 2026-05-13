// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddToCartButton } from "./add-to-cart-button";
import { CartProvider } from "../../../lib/cart-store";

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

  it("starts at quantity 1", () => {
    renderWithCart(<AddToCartButton {...baseProps} />);
    expect(screen.getByText("1")).toBeDefined();
  });

  it("plus button increments past 1", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton {...baseProps} />);
    await user.click(screen.getByLabelText("Increase quantity"));
    await user.click(screen.getByLabelText("Increase quantity"));
    expect(screen.getByText("3")).toBeDefined();
  });

  it("minus button never goes below 1 (clamp)", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton {...baseProps} />);
    await user.click(screen.getByLabelText("Decrease quantity"));
    await user.click(screen.getByLabelText("Decrease quantity"));
    expect(screen.getByText("1")).toBeDefined();
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
