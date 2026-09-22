// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";

// GOL-2233 follow-up: a sold-out bareroot cart is ONE flat $10 reservation
// deposit at checkout, but the cart summary only knew unit prices, so it showed
// the goods total ("$12.84") as if that were the charge. With a quote href
// wired, the summary must say what is actually due today.

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

describe("<CartPage /> — flat reservation deposit shown as due today", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedCart();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("quotes the cart and shows the $10 deposit above the order total", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ depositNow: true, depositReason: "sold-out", amountDueToday: 10 }),
    );

    render(
      <CartProvider>
        <CartPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );

    expect(await screen.findByText("Due today (reservation deposit)")).toBeTruthy();
    expect(screen.getAllByText("$10.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Order subtotal")).toBeTruthy();
    expect(screen.getByText(/one flat \$10 deposit today, no matter how many trees/)).toBeTruthy();
    // The generic "not charged today" reassurance would contradict the row.
    expect(screen.queryByText(/You will not be charged today/)).toBeNull();

    const [href, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(href).toBe("/api/cart/quote");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      items: [{ variantId: 196, templateId: 19, quantity: 1 }],
      fulfillment: null,
    });
  });

  it("keeps the plain total when the quote says the cart is charged in full", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ depositNow: false, depositReason: null, amountDueToday: null }),
    );
    render(
      <CartProvider>
        <CartPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByText("Order Summary");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Due today (reservation deposit)")).toBeNull();
    expect(screen.getByText("Subtotal")).toBeTruthy();
    // No client-side tax estimate: tax is a backend line on Review & pay.
    expect(screen.queryByText(/Tax \(estimated/)).toBeNull();
  });

  it("never quotes when no href is wired (brands without a charge rule)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );
    await screen.findByText("Order Summary");
    await new Promise((r) => setTimeout(r, 350)); // past the hook's debounce
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("Due today (reservation deposit)")).toBeNull();
  });
});
