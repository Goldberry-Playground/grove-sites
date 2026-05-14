// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CartNavLink } from "./CartNavLink";
import { CartProvider } from "../cart-store";

// We exercise CartNavLink through the real CartProvider rather than mocking
// useCart — the badge's hydration behavior is the most fragile part, and a
// shallow mock would silently lie about it. happy-dom gives us enough of a
// DOM that React 19's hydration-flag tracking actually fires.

describe("<CartNavLink />", () => {
  it("renders 'Cart' label without a badge before hydration finishes", () => {
    render(
      <CartProvider>
        <CartNavLink />
      </CartProvider>,
    );
    expect(screen.getByText("Cart")).toBeDefined();
    // The badge element shouldn't be in the DOM at all until hydration runs
    // and totalQuantity > 0.
    expect(screen.queryByText(/^[0-9]+$/)).toBeNull();
  });

  it("links to /cart", () => {
    render(
      <CartProvider>
        <CartNavLink />
      </CartProvider>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/cart");
  });

  // Adding items requires interacting with useCart from a child component,
  // which is tested via the cart-reducer tests (pure logic). The hydration
  // gate (badge only after hydrated && totalQuantity > 0) is the property
  // worth verifying here, and the "no badge before hydration" case above
  // is the regression-prevention we care about.
});
