// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./CheckoutPage";
import { CartProvider } from "../cart-store";

vi.mock("@grove/analytics", () => ({ trackBeginCheckout: vi.fn() }));

const line = (variantId: number, wave?: string) => ({
  variantId,
  templateId: variantId,
  name: `Tree ${variantId}`,
  price: 12,
  imageUrl: "/x.jpg",
  quantity: 1,
  ...(wave ? { wave } : {}),
});
function seed(lines: unknown[]) {
  window.localStorage.setItem("grove-cart-v1", JSON.stringify(lines));
}
function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}
const submits = () => screen.getAllByRole("button", { name: /Continue to payment/ }) as HTMLButtonElement[];

describe("<CheckoutPage /> — pre-order wave", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("names a pre-order and sends its wave to the quote", async () => {
    seed([line(1, "fall"), line(2, "fall")]);
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ depositNow: true, depositReason: "preorder", shipWave: "fall", amountDueToday: 10 }));
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByTestId("order-type")).textContent).toBe(
      "Pre-order · fall wave · $10 deposit today, balance when your trees ship",
    );
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const body = JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.shipWave).toBe("fall");
    expect(submits().every((b) => !b.disabled)).toBe(true);
  });

  it("names an immediate order and sends no wave", async () => {
    seed([line(1)]);
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ depositNow: false, amountDueToday: null }));
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    expect((await screen.findByTestId("order-type")).textContent).toBe("Ships now or ready for pickup · charged in full");
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const body = JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body));
    expect("shipWave" in body).toBe(false);
  });

  it("blocks a stale mixed cart with a banner and a disabled submit", async () => {
    seed([line(1, "fall"), line(2)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ depositNow: false }));
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByRole("alert")).textContent).toMatch(/^Pre-orders check out on their own/);
    expect(submits().every((b) => b.disabled)).toBe(true);
  });

  it("shows the backend's 400 from the quote and blocks submit", async () => {
    seed([line(1, "spring")]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "The spring wave is closed for your zone." }, 400));
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByRole("alert")).textContent).toBe("The spring wave is closed for your zone.");
    expect(submits().every((b) => b.disabled)).toBe(true);
  });

  it("posts the cart's wave in the session body", async () => {
    seed([line(1, "fall")]);
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).includes("/api/checkout/session")
        ? jsonResponse({ error: "stop here" }, 400)
        : jsonResponse({ depositNow: true, depositReason: "preorder", shipWave: "fall", amountDueToday: 10 }),
    );
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Full name/), "Pat Buyer");
    await user.type(screen.getByLabelText(/Email/), "buyer@example.com");
    await user.type(screen.getByLabelText(/Phone/), "3045551212");
    await user.type(screen.getByLabelText(/Street/), "1 Main St");
    await user.type(screen.getByLabelText(/City/), "Bluefield");
    await user.type(screen.getByLabelText(/ZIP/), "24701");
    await user.selectOptions(screen.getByLabelText(/State/), "WV");
    fireEvent.click(submits()[1]);
    await waitFor(() => expect(spy.mock.calls.some((c) => String(c[0]).includes("/api/checkout/session"))).toBe(true));
    const call = spy.mock.calls.find((c) => String(c[0]).includes("/api/checkout/session"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body)).shipWave).toBe("fall");
  });
});
