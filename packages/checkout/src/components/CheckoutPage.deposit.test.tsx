// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./CheckoutPage";
import { CartProvider } from "../cart-store";

vi.mock("@grove/analytics", () => ({
  trackBeginCheckout: vi.fn(),
}));

function seedCart() {
  window.localStorage.setItem(
    "grove-cart-v1",
    JSON.stringify([
      {
        variantId: 196,
        templateId: 19,
        name: "Service Berry (Seedling, Bareroot)",
        price: 12.0,
        imageUrl: "/web/image/product.product/196/image_128",
        quantity: 1,
      },
    ]),
  );
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("<CheckoutPage /> — flat reservation deposit shown before the Stripe step", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedCart();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the $10 due today in the banner and the summary, and re-quotes on pickup", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ depositNow: true, depositReason: "sold-out", amountDueToday: 10 }),
    );

    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);

    expect(await screen.findByText("Due today (reservation deposit)")).toBeTruthy();
    expect(screen.getByText(/1 item · reservation/)).toBeTruthy();
    expect(screen.getByText(/due today · balance when your trees ship/)).toBeTruthy();
    expect(screen.getByText("Order subtotal")).toBeTruthy();

    const firstBody = JSON.parse(String((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(firstBody.fulfillment).toBe("ship");

    // Switching to farm pickup must re-quote with the new fulfillment.
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Farm pickup/));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
    const lastBody = JSON.parse(
      String((fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1] as [string, RequestInit])[1].body),
    );
    expect(lastBody.fulfillment).toBe("pickup");
    expect(screen.getByText(/farm pickup · reservation/)).toBeTruthy();
  });

  it("falls back to the plain estimate when the quote endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      { ok: false, status: 502, json: async () => ({}) } as unknown as Response,
    );
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Due today (reservation deposit)")).toBeNull();
    expect(screen.getByText("Subtotal")).toBeTruthy();
    expect(screen.getByText(/ready to ship/)).toBeTruthy();
  });
});
