// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./CheckoutPage";
import { CartProvider } from "../cart-store";

// GOL-942: the checkout "Continue to payment" step POSTs to
// /api/checkout/session and expected JSON. When that request never reaches the
// route handler (an undeployed-route 404, a framework 500, or a CDN/proxy 502)
// the body is HTML, and the old code called `response.json()` unconditionally —
// so a raw "JSON.parse: unexpected character" / "Unexpected token '<'" leaked
// straight into the buyer's checkout error box on the final step. These tests
// pin the graceful behavior: a friendly, human error instead of a parser dump.

vi.mock("@grove/analytics", () => ({
  trackBeginCheckout: vi.fn(),
}));

// Seed a single cart line so the checkout form (not the empty state) renders.
// STORAGE_KEY resolves to `${NEXT_PUBLIC_TENANT_ID ?? "grove"}-cart-v1`.
function seedCart() {
  window.localStorage.setItem(
    "grove-cart-v1",
    JSON.stringify([
      {
        variantId: 2,
        templateId: 2,
        name: "Mulberry (AU Rubrum, Bareroot)",
        price: 15.0,
        imageUrl: "/web/image/product.product/2/image_128",
        quantity: 1,
      },
    ]),
  );
}

function textResponse(status: number, ok: boolean, body: string): Response {
  return { ok, status, text: async () => body } as unknown as Response;
}

async function fillFormAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Full name/), "Martin Westlund");
  await user.type(screen.getByLabelText(/Email/), "buyer@example.com");
  await user.type(screen.getByLabelText(/Street/), "1 Discord Avenue");
  await user.type(screen.getByLabelText(/City/), "Bluefield");
  await user.type(screen.getByLabelText(/ZIP/), "24701");
  // State is a required select (no silent default) — pick a supported one.
  // Country defaults to US (first/only option).
  await user.selectOptions(screen.getByLabelText(/State/), "WV");
  const submit = document.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  fireEvent.click(submit!);
}

async function renderCheckout() {
  render(
    <CartProvider>
      <CheckoutPage />
    </CartProvider>,
  );
  // Wait past cart hydration (loading → form).
  await screen.findByLabelText(/Full name/);
}

describe("<CheckoutPage /> — session error handling (GOL-942)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedCart();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a friendly error (not a JSON.parse dump) when the endpoint returns an HTML page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(
        404,
        false,
        "<!DOCTYPE html><html><body>Not Found</body></html>",
      ),
    );

    await renderCheckout();
    await fillFormAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "We couldn't start secure checkout. Please try again.",
    );
    // The raw parser error must never reach the buyer.
    expect(alert.textContent).not.toMatch(/JSON\.parse|Unexpected token|DOCTYPE/i);
  });

  it("surfaces the server's sanitized error message on a 502 JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(
        502,
        false,
        JSON.stringify({
          error: "Service temporarily unavailable. Please try again.",
        }),
      ),
    );

    await renderCheckout();
    await fillFormAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Service temporarily unavailable. Please try again.",
    );
  });

  it("shows a connection error when the fetch itself rejects (offline)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await renderCheckout();
    await fillFormAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "We couldn't reach secure checkout. Check your connection and try again.",
    );
  });

  it("advances to the review step when the session is minted", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(
        200,
        true,
        JSON.stringify({
          orderId: 101,
          accessToken: "tok_abc",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
          amountDueToday: 16.05,
          amountTotal: 16.05,
          hasPreorder: false,
          currency: "usd",
        }),
      ),
    );

    await renderCheckout();
    await fillFormAndSubmit();

    // CheckoutReview renders a "Pay $… with card →" action; no error alert.
    await waitFor(() =>
      expect(screen.getByText(/Pay .* with card/)).toBeDefined(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("<CheckoutPage /> — state & country selects (GOL-1055)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedCart();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders State and Country as constrained selects, not free text", async () => {
    await renderCheckout();
    const state = screen.getByLabelText(/State/);
    const country = screen.getByLabelText(/Country/);
    expect(state.tagName).toBe("SELECT");
    expect(country.tagName).toBe("SELECT");
  });

  it("offers only supported ship-to states — an unsupported state can't be picked", async () => {
    await renderCheckout();
    const state = screen.getByLabelText(/State/) as HTMLSelectElement;
    const codes = Array.from(state.options).map((o) => o.value);
    // Supported greens are present (kills the "Ohio" vs "OH" bug — value is "OH").
    expect(codes).toContain("OH");
    expect(codes).toContain("WV");
    // Non-green / non-code values are simply not options, so unselectable.
    expect(codes).not.toContain("TX");
    expect(codes).not.toContain("CA");
    expect(codes).not.toContain("Ohio");
  });

  it("starts with no state chosen (required forces an explicit valid pick)", async () => {
    await renderCheckout();
    const state = screen.getByLabelText(/State/) as HTMLSelectElement;
    expect(state.value).toBe("");
    expect(state.required).toBe(true);
  });

  it("defaults Country to US", async () => {
    await renderCheckout();
    const country = screen.getByLabelText(/Country/) as HTMLSelectElement;
    expect(country.value).toBe("US");
  });

  it("submits the picked 2-letter state code to the session route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(
        200,
        true,
        JSON.stringify({
          orderId: 1,
          accessToken: "t",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_1",
          amountDueToday: 1,
          amountTotal: 1,
          hasPreorder: false,
          currency: "usd",
        }),
      ),
    );

    await renderCheckout();
    await fillFormAndSubmit();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.shipping.state).toBe("WV");
    expect(body.shipping.country).toBe("US");
  });
});
