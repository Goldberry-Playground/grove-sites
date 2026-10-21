// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";
import { CONSULT_LABEL, CONSULT_REMOVED_MESSAGE } from "../consult";

// GOL-3384 (order-builder spec D.2): the free 15-minute planting consult. Odoo's
// quote says whether the cart qualifies (`consultEligible`) and names the
// consult variant (`consultVariantId`, GOL-3541); the cart page shows a checkbox
// under the totals only then. The tick is a choice kept beside the cart, never
// a goods line, and it is dropped (with a reason) when the quote withdraws the
// offer. The storefront never computes the $500 threshold itself.

const CONSULT_KEY = "grove-cart-v1-consult";

function seedCart(quantity = 1) {
  window.localStorage.setItem(
    "grove-cart-v1",
    JSON.stringify([
      {
        variantId: 196,
        templateId: 19,
        name: "Service Berry (Seedling, Bareroot)",
        price: 120.0,
        imageUrl: "/web/image/product.product/196/image_128",
        quantity,
      },
    ]),
  );
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const chargedInFull = { depositNow: false, depositReason: null, amountDueToday: null };
const offered = { ...chargedInFull, consultEligible: true, consultVariantId: 412 };
const notOffered = { ...chargedInFull, consultEligible: false, consultVariantId: 412 };

function renderCart() {
  return render(
    <CartProvider>
      <CartPage depositQuoteHref="/api/cart/quote" />
    </CartProvider>,
  );
}

describe("<CartPage /> — free planting consult checkbox (GOL-3384)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedCart(5);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the checkbox only once the quote offers the consult, and never on a cart it does not", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(notOffered));
    renderCart();
    await screen.findByText("Order Summary");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByRole("checkbox", { name: CONSULT_LABEL })).toBeNull();
    expect(screen.queryByTestId("consult-offer")).toBeNull();
  });

  it("shows no checkbox when the quote is eligible but names no variant (backend predates GOL-3541)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ...chargedInFull, consultEligible: true, consultVariantId: null }),
    );
    renderCart();
    await screen.findByText("Order Summary");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("checkbox", { name: CONSULT_LABEL })).toBeNull();
  });

  it("ticking records the choice beside the cart and unticking clears it; the goods lines never change", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(offered));
    renderCart();
    const box = await screen.findByRole("checkbox", { name: CONSULT_LABEL });
    expect((box as HTMLInputElement).checked).toBe(false);
    expect(box.getAttribute("aria-describedby")).toBeTruthy();

    const user = userEvent.setup();
    await user.click(box);
    expect((box as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(window.localStorage.getItem(CONSULT_KEY)).toBe("1"));
    // Still one goods line, and the quote payload still lists goods only.
    expect(JSON.parse(window.localStorage.getItem("grove-cart-v1")!)).toHaveLength(1);
    const quoteCalls = fetchSpy.mock.calls.filter(([href]) => href === "/api/cart/quote");
    for (const [, init] of quoteCalls as [string, RequestInit][]) {
      expect(JSON.parse(String(init.body)).items).toEqual([{ variantId: 196, templateId: 19, quantity: 5 }]);
    }

    await user.click(box);
    expect((box as HTMLInputElement).checked).toBe(false);
    await waitFor(() => expect(window.localStorage.getItem(CONSULT_KEY)).toBeNull());
  });

  it("restores a ticked consult on reload and drops it, saying why, when the quote withdraws the offer", async () => {
    window.localStorage.setItem(CONSULT_KEY, "1");
    let quoteBody: unknown = offered;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse(quoteBody));
    renderCart();
    const box = await screen.findByRole("checkbox", { name: CONSULT_LABEL });
    await waitFor(() => expect((box as HTMLInputElement).checked).toBe(true));
    expect(screen.queryByTestId("consult-removed")).toBeNull();

    // The shopper takes trees out; the next quote says the cart no longer qualifies.
    quoteBody = notOffered;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Decrease quantity of Service Berry/ }));

    const reason = await screen.findByTestId("consult-removed");
    expect(reason.textContent).toContain(CONSULT_REMOVED_MESSAGE);
    expect(reason.getAttribute("role")).toBe("status");
    expect(screen.queryByRole("checkbox", { name: CONSULT_LABEL })).toBeNull();
    await waitFor(() => expect(window.localStorage.getItem(CONSULT_KEY)).toBeNull());
  });

  it("keeps a ticked consult through a failed re-quote (charge mode unknown, nothing is withdrawn)", async () => {
    window.localStorage.setItem(CONSULT_KEY, "1");
    let fail = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      fail ? ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response) : jsonResponse(offered),
    );
    renderCart();
    const box = await screen.findByRole("checkbox", { name: CONSULT_LABEL });
    await waitFor(() => expect((box as HTMLInputElement).checked).toBe(true));

    fail = true;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Increase quantity of Service Berry/ }));
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(window.localStorage.getItem(CONSULT_KEY)).toBe("1");
    expect(screen.queryByTestId("consult-removed")).toBeNull();
  });

  it("never asks for the consult when no quote route is wired (brands without the offer)", async () => {
    window.localStorage.setItem(CONSULT_KEY, "1");
    vi.spyOn(globalThis, "fetch");
    render(
      <CartProvider>
        <CartPage />
      </CartProvider>,
    );
    await screen.findByText("Order Summary");
    await new Promise((r) => setTimeout(r, 350));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox", { name: CONSULT_LABEL })).toBeNull();
    expect(screen.queryByTestId("consult-removed")).toBeNull();
  });
});
