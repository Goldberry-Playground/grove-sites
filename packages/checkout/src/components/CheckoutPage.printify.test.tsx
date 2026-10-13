// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../cart-store";
import { CheckoutPage } from "./CheckoutPage";

vi.mock("@grove/analytics", () => ({ trackBeginCheckout: vi.fn() }));

/**
 * Live Printify shipping on the farm checkout page (GOL-3315, gom printify
 * spec Storefront §4). The cart page has no address so it keeps "At checkout";
 * here the shipping row is Printify's own figure once state and ZIP are typed,
 * "Enter your address" before that, and the backend's refusal when Printify
 * does not answer. Submit stays blocked whenever there is no live amount, so a
 * shirt order is never started on a guessed price.
 */

const unavailable = "Shipping is temporarily unavailable. Try again in a few minutes.";
const reply = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

/** Quote the way the backend does: an amount only once state AND zip are known. */
function printifyBackend(amount = 4.75) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { state?: string; zip?: string };
    return reply(200, {
      depositNow: false,
      depositReason: null,
      amountDueToday: null,
      fulfillmentRoute: "printify",
      shippingAmount: body.state && body.zip ? amount : null,
    });
  });
}

beforeEach(() => {
  window.localStorage.setItem(
    "grove-cart-v1",
    JSON.stringify([{ variantId: 1, templateId: 7, name: "Grove Tee (Natural, M)", price: 28, imageUrl: "", quantity: 1 }]),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function farmCheckout() {
  return render(
    <CartProvider>
      <CheckoutPage brand="goldberry" depositQuoteHref="/api/cart/quote" liveShipping />
    </CartProvider>,
  );
}

const submit = () => screen.getAllByRole("button", { name: /Continue to payment/ })[0] as HTMLButtonElement;

async function fillAddress(user = userEvent.setup()) {
  await screen.findByLabelText(/Full name/);
  await user.selectOptions(screen.getByLabelText(/State/), "CA");
  await user.type(screen.getByLabelText(/ZIP/), "90001");
}

describe("<CheckoutPage /> — live Printify shipping (GOL-3315)", () => {
  it("asks for the address before quoting and blocks submit", async () => {
    printifyBackend();
    farmCheckout();
    expect(await screen.findByText("Enter your address")).toBeTruthy();
    await waitFor(() => expect(submit().disabled).toBe(true));
    expect(screen.queryByText("On the next step", { selector: "dd" })).toBeTruthy(); // sales tax row only
  });

  it("shows Printify's live amount once state and ZIP are typed, then allows submit", async () => {
    const spy = printifyBackend(4.75);
    farmCheckout();
    await fillAddress();
    expect(await screen.findByText("$4.75")).toBeTruthy();
    await waitFor(() => expect(submit().disabled).toBe(false));
    const last = JSON.parse(String((spy.mock.calls.at(-1) as [string, RequestInit])[1].body));
    expect(last).toMatchObject({ state: "CA", zip: "90001" });
  });

  it("offers all 50 states and DC to the farm shopper", async () => {
    printifyBackend();
    farmCheckout();
    await screen.findByLabelText(/Full name/);
    const codes = Array.from((screen.getByLabelText(/State/) as HTMLSelectElement).options).map((o) => o.value);
    for (const code of ["CA", "HI", "AK", "DC", "WV"]) expect(codes).toContain(code);
    expect(codes.filter(Boolean)).toHaveLength(51);
    expect(screen.getByText("We ship shirts to all 50 states and Washington, DC.")).toBeTruthy();
  });

  it("blocks submit with the 503 message when Printify is down", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { state?: string; zip?: string };
      return body.state && body.zip
        ? reply(503, { error: unavailable })
        : reply(200, { depositNow: false, depositReason: null, amountDueToday: null, fulfillmentRoute: "printify", shippingAmount: null });
    });
    farmCheckout();
    await fillAddress();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(unavailable);
    expect(submit().disabled).toBe(true);
    expect(screen.queryByText("$4.75")).toBeNull();
  });

  it("blocks submit with the 409 mixed-cart message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(409, { error: "Shirts check out separately from trees." }));
    farmCheckout();
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByRole("alert")).textContent).toBe("Shirts check out separately from trees.");
    expect(submit().disabled).toBe(true);
  });

  it("never shows a guessed amount when the quote itself fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { state?: string; zip?: string };
      if (body.state && body.zip) throw new TypeError("network");
      return reply(200, { depositNow: false, depositReason: null, amountDueToday: null, fulfillmentRoute: "printify", shippingAmount: null });
    });
    farmCheckout();
    await fillAddress();
    expect(await screen.findByText("Unavailable")).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toBe(unavailable);
    expect(submit().disabled).toBe(true);
  });

  it("re-blocks while a new destination is being re-quoted", async () => {
    printifyBackend();
    farmCheckout();
    const user = userEvent.setup();
    await fillAddress(user);
    await screen.findByText("$4.75");
    await user.selectOptions(screen.getByLabelText(/State/), "NY");
    expect(screen.getByText("Checking…")).toBeTruthy();
    expect(submit().disabled).toBe(true);
    expect(await screen.findByText("$4.75")).toBeTruthy();
  });
});

describe("<CheckoutPage /> — nursery unchanged by the live-shipping option", () => {
  it("keeps 'On the next step' for shipping and ignores shippingAmount when not opted in", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null, shippingAmount: 4.75 }),
    );
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);
    await waitFor(() => expect(screen.getAllByText("On the next step")).toHaveLength(2));
    expect(screen.queryByText("$4.75")).toBeNull();
    expect(screen.queryByText("Enter your address")).toBeNull();
  });
});
