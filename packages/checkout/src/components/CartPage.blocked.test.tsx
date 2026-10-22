// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";

/**
 * GOL-3583: a cart the quote refuses (a potted line past its cutoff, 400) showed
 * the red notice but kept "Checkout Now" and "Proceed to Checkout" as live links
 * to a checkout that refuses the same cart. Both must stop navigating.
 */

const line = { variantId: 1, templateId: 1, name: "Potted Pawpaw", price: 35, imageUrl: "/x.jpg", quantity: 1 };
const REFUSAL = "Potted trees stopped shipping for the season on Oct 15. Remove Potted Pawpaw to check out.";

function mockQuote(res: { ok: boolean; status: number; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () => ({ ok: res.ok, status: res.status, json: async () => res.body }) as unknown as Response,
  );
}
const renderCart = () =>
  render(
    <CartProvider>
      <CartPage depositQuoteHref="/api/cart/quote" />
    </CartProvider>,
  );
const ctas = () => [screen.getByText(/Checkout Now/), screen.getByText(/Proceed to Checkout/)].map((n) => n.closest("a, [role=link]")!);

describe("<CartPage /> — checkout CTAs when the quote refuses the cart", () => {
  beforeEach(() => window.localStorage.setItem("grove-cart-v1", JSON.stringify([line])));
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("disables both CTAs and says why on a 400 refusal", async () => {
    mockQuote({ ok: false, status: 400, body: { error: REFUSAL } });
    renderCart();
    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
    for (const cta of ctas()) {
      expect(cta.tagName).not.toBe("A");
      expect(cta.hasAttribute("href")).toBe(false);
      expect(cta.getAttribute("aria-disabled")).toBe("true");
      const hint = document.getElementById(cta.getAttribute("aria-describedby")!);
      expect(hint?.textContent).toMatch(/Checkout opens again/);
    }
  });

  it("keeps both CTAs as links to /checkout on an accepted quote", async () => {
    mockQuote({ ok: true, status: 200, body: { depositNow: false, amountDueToday: null } });
    renderCart();
    await waitFor(() => expect(screen.getByText(/Proceed to Checkout/)).toBeTruthy());
    await new Promise((r) => setTimeout(r, 300));
    for (const cta of ctas()) {
      expect(cta.tagName).toBe("A");
      expect(cta.getAttribute("href")).toBe("/checkout");
    }
    expect(screen.queryByText(/Checkout opens again/)).toBeNull();
  });
});
