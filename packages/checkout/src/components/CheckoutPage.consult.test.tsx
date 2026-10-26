// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./CheckoutPage";
import { CartProvider } from "../cart-store";
import { CONSULT_LABEL, CONSULT_REMOVED_MESSAGE } from "../consult";

// GOL-3384 (order-builder spec D.2), checkout half: a ticked consult becomes
// exactly one $0 consult line in the session payload, only while the quote
// still offers it; a quote that withdraws the offer drops the tick and says
// why; and the backend's 400 on an ineligible order shows inline in the form,
// never as a crash.

vi.mock("@grove/analytics", () => ({
  trackBeginCheckout: vi.fn(),
}));

const CONSULT_KEY = "grove-cart-v1-consult";
const CONSULT_REFUSED = "The free planting consult isn't available on this order.";

function seedCart() {
  window.localStorage.setItem(
    "grove-cart-v1",
    JSON.stringify([
      {
        variantId: 2,
        templateId: 2,
        name: "Mulberry (AU Rubrum, Bareroot)",
        price: 120.0,
        imageUrl: "/web/image/product.product/2/image_128",
        quantity: 5,
      },
    ]),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => text } as unknown as Response;
}

const offered = { depositNow: false, depositReason: null, amountDueToday: null, consultEligible: true, consultVariantId: 412 };
const notOffered = { ...offered, consultEligible: false };

const session = {
  orderId: 77,
  accessToken: "tok",
  checkoutUrl: "https://checkout.stripe.test/s/1",
  amountDueToday: 600,
  amountTotal: 600,
  hasPreorder: false,
  currency: "USD",
  lineItems: [],
};

async function fillFormAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Full name/), "Martin Westlund");
  await user.type(screen.getByLabelText(/Email/), "buyer@example.com");
  await user.type(screen.getByLabelText(/Phone/), "3045551212");
  await user.type(screen.getByLabelText(/Street/), "1 Discord Avenue");
  await user.type(screen.getByLabelText(/City/), "Bluefield");
  await user.type(screen.getByLabelText(/ZIP/), "24701");
  await user.selectOptions(screen.getByLabelText(/State/), "WV");
  const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]');
  await waitFor(() => expect(submit!.disabled).toBe(false));
  fireEvent.click(submit!);
}

function mockRoutes(quote: () => unknown, sessionResponse: () => Response) {
  const calls: { href: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const href = String(input);
    calls.push({ href, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (href === "/api/cart/quote") return jsonResponse(200, quote());
    if (href === "/api/checkout/session") return sessionResponse();
    return jsonResponse(404, { error: "not found" });
  });
  return calls;
}

async function renderCheckout() {
  render(
    <CartProvider>
      <CheckoutPage depositQuoteHref="/api/cart/quote" />
    </CartProvider>,
  );
  await screen.findByLabelText(/Full name/);
}

describe("<CheckoutPage /> — free planting consult line (GOL-3384)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedCart();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends exactly one consult line after the goods when ticked and offered", async () => {
    window.localStorage.setItem(CONSULT_KEY, "1");
    const calls = mockRoutes(() => offered, () => jsonResponse(200, session));
    await renderCheckout();
    const box = await screen.findByRole("checkbox", { name: CONSULT_LABEL });
    await waitFor(() => expect((box as HTMLInputElement).checked).toBe(true));

    await fillFormAndSubmit();
    await waitFor(() => expect(calls.some((c) => c.href === "/api/checkout/session")).toBe(true));
    const posted = calls.find((c) => c.href === "/api/checkout/session")!.body as { items: unknown[] };
    expect(posted.items).toEqual([
      { variantId: 2, quantity: 5 },
      { variantId: 412, quantity: 1 },
    ]);
    // The review step lists the consult beside the goods.
    expect(await screen.findByText("Planting consult, 15 minutes")).toBeTruthy();
  });

  it("sends goods only when the box is not ticked, and the checkbox can be ticked here too", async () => {
    const calls = mockRoutes(() => offered, () => jsonResponse(200, session));
    await renderCheckout();
    const box = await screen.findByRole("checkbox", { name: CONSULT_LABEL });
    expect((box as HTMLInputElement).checked).toBe(false);
    await fillFormAndSubmit();
    await waitFor(() => expect(calls.some((c) => c.href === "/api/checkout/session")).toBe(true));
    const posted = calls.find((c) => c.href === "/api/checkout/session")!.body as { items: unknown[] };
    expect(posted.items).toEqual([{ variantId: 2, quantity: 5 }]);
  });

  it("drops a ticked consult, says why, and sends goods only when the quote no longer offers it", async () => {
    window.localStorage.setItem(CONSULT_KEY, "1");
    const calls = mockRoutes(() => notOffered, () => jsonResponse(200, session));
    await renderCheckout();
    const reason = await screen.findByTestId("consult-removed");
    expect(reason.textContent).toContain(CONSULT_REMOVED_MESSAGE);
    expect(screen.queryByRole("checkbox", { name: CONSULT_LABEL })).toBeNull();
    await waitFor(() => expect(window.localStorage.getItem(CONSULT_KEY)).toBeNull());

    await fillFormAndSubmit();
    await waitFor(() => expect(calls.some((c) => c.href === "/api/checkout/session")).toBe(true));
    const posted = calls.find((c) => c.href === "/api/checkout/session")!.body as { items: unknown[] };
    expect(posted.items).toEqual([{ variantId: 2, quantity: 5 }]);
  });

  it("surfaces the backend's 400 on the consult line inline, and the form stays usable", async () => {
    window.localStorage.setItem(CONSULT_KEY, "1");
    mockRoutes(() => offered, () => jsonResponse(400, { error: CONSULT_REFUSED }));
    await renderCheckout();
    await screen.findByRole("checkbox", { name: CONSULT_LABEL });
    await fillFormAndSubmit();
    expect(await screen.findByText(CONSULT_REFUSED)).toBeTruthy();
    // Still on the form (no review step), with the consult box still there to untick.
    expect(screen.getByLabelText(/Full name/)).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: CONSULT_LABEL })).toBeTruthy();
  });
});
