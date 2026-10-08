// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./CheckoutPage";
import { CartProvider } from "../cart-store";
import { QUOTE_REFUSED_FALLBACK } from "../hooks/useCartDepositQuote";

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
    // Submit waits for the quote of the completed ZIP (no stale-quote submit).
    await waitFor(() => expect(submits()[1].disabled).toBe(false));
    fireEvent.click(submits()[1]);
    await waitFor(() => expect(spy.mock.calls.some((c) => String(c[0]).includes("/api/checkout/session"))).toBe(true));
    const call = spy.mock.calls.find((c) => String(c[0]).includes("/api/checkout/session"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body)).shipWave).toBe("fall");
  });

  it("labels a legacy cart the backend prices as a deposit as a pre-order, not charged in full", async () => {
    seed([line(1)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ depositNow: true, depositReason: "off-season", amountDueToday: 10 }),
    );
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("order-type").textContent).toBe(
        "Pre-order · $10 deposit today, balance when your trees ship",
      ),
    );
  });

  describe("pre-order deposit confirmation (older backend guard)", () => {
    const UNCONFIRMED = "We could not confirm your pre-order deposit. Please try again shortly.";
    async function renderWith(quote: unknown, status = 200) {
      seed([line(1, "fall")]);
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(quote, status));
      render(
        <CartProvider>
          <CheckoutPage depositQuoteHref="/api/cart/quote" />
        </CartProvider>,
      );
      await screen.findByLabelText(/Full name/);
      await waitFor(() => expect(spy).toHaveBeenCalled());
      return spy;
    }

    it("allows submit when the backend echoes the same wave with depositNow", async () => {
      await renderWith({ depositNow: true, depositReason: "preorder", shipWave: "fall", amountDueToday: 10 });
      await waitFor(() => expect(submits().every((b) => !b.disabled)).toBe(true));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("blocks submit when an older backend ignores the wave (no shipWave echo)", async () => {
      await renderWith({ depositNow: false, depositReason: null, amountDueToday: null });
      expect((await screen.findByRole("alert")).textContent).toBe(UNCONFIRMED);
      expect(submits().every((b) => b.disabled)).toBe(true);
    });

    it("blocks submit when the quote echoes a different wave", async () => {
      await renderWith({ depositNow: true, depositReason: "preorder", shipWave: "spring", amountDueToday: 10 });
      expect((await screen.findByRole("alert")).textContent).toBe(UNCONFIRMED);
      expect(submits().every((b) => b.disabled)).toBe(true);
    });

    it("blocks submit when the wave is echoed but depositNow is false", async () => {
      await renderWith({ depositNow: false, depositReason: null, shipWave: "fall", amountDueToday: null });
      expect((await screen.findByRole("alert")).textContent).toBe(UNCONFIRMED);
      expect(submits().every((b) => b.disabled)).toBe(true);
    });

    it("blocks submit on the route's display-only fallback estimate", async () => {
      await renderWith({
        depositNow: true,
        depositReason: "preorder",
        shipWave: "fall",
        depositAmount: 10,
        amountDueToday: 10,
        estimated: true,
      });
      expect((await screen.findByRole("alert")).textContent).toBe(UNCONFIRMED);
      expect(submits().every((b) => b.disabled)).toBe(true);
      // The estimate still shows the $10 due today (display only).
      expect(screen.getAllByText(/\$10\.00/).length).toBeGreaterThan(0);
    });

    it("blocks submit and says so when the quote fails outright (5xx)", async () => {
      await renderWith({ error: "upstream" }, 502);
      expect((await screen.findByRole("alert")).textContent).toBe(UNCONFIRMED);
      expect(submits().every((b) => b.disabled)).toBe(true);
    });
  });

  describe("zone mismatch: the destination ZIP closes the wave (GOL-3194)", () => {
    const CLOSED_FALL = "The fall pre-order for zone 3 closed on Nov 12. Choose spring.";
    const quoteBodies = (spy: { mock: { calls: unknown[][] } }) =>
      spy.mock.calls
        .filter((c) => String(c[0]).includes("/api/cart/quote"))
        .map((c) => JSON.parse(String((c[1] as RequestInit).body)) as Record<string, unknown>);

    /** A backend that refuses fall for ZIP 55401 (zone 3, past Nov 12) and
     *  confirms spring; `springOpen: false` refuses spring as well. */
    function zoneBackend({ springOpen = true } = {}) {
      return vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        const body = JSON.parse(String((init as RequestInit).body)) as { shipWave?: string; zip?: string };
        if (body.zip === "55401" && body.shipWave === "fall") {
          return jsonResponse(
            springOpen ? { error: CLOSED_FALL, alternateWave: "spring" } : { error: CLOSED_FALL },
            400,
          );
        }
        if (body.zip === "55401" && body.shipWave === "spring" && !springOpen) {
          return jsonResponse({ error: "The spring pre-order for zone 3 closed on May 31." }, 400);
        }
        return jsonResponse({ depositNow: true, depositReason: "preorder", shipWave: body.shipWave, amountDueToday: 10 });
      });
    }

    function renderCheckout() {
      render(
        <CartProvider>
          <CheckoutPage depositQuoteHref="/api/cart/quote" />
        </CartProvider>,
      );
    }

    it("re-quotes with the ZIP once it is complete, not on every keystroke", async () => {
      seed([line(1, "fall")]);
      const spy = zoneBackend();
      renderCheckout();
      const user = userEvent.setup();
      await waitFor(() => expect(quoteBodies(spy)).toHaveLength(1));
      expect("zip" in quoteBodies(spy)[0]).toBe(false);
      await user.type(screen.getByLabelText(/ZIP/), "2470");
      await new Promise((r) => setTimeout(r, 400));
      expect(quoteBodies(spy)).toHaveLength(1);
      await user.type(screen.getByLabelText(/ZIP/), "1");
      await waitFor(() => expect(quoteBodies(spy).at(-1)).toMatchObject({ shipWave: "fall", zip: "24701" }));
    });

    it("surfaces the closed wave as soon as the ZIP is known and switches the order to spring", async () => {
      seed([line(1, "fall"), line(2, "fall")]);
      const spy = zoneBackend();
      renderCheckout();
      const user = userEvent.setup();
      await screen.findByLabelText(/Full name/);
      await waitFor(() => expect(submits().every((b) => !b.disabled)).toBe(true));

      await user.type(screen.getByLabelText(/ZIP/), "55401");
      expect((await screen.findByRole("alert")).textContent).toBe(CLOSED_FALL);
      expect(submits().every((b) => b.disabled)).toBe(true);

      await user.click(await screen.findByRole("button", { name: "Switch this order to the spring wave" }));

      // Every line moved to spring (one wave per order), and the quote re-ran on it.
      await waitFor(() =>
        expect(JSON.parse(window.localStorage.getItem("grove-cart-v1")!).map((l: { wave: string }) => l.wave)).toEqual([
          "spring",
          "spring",
        ]),
      );
      await waitFor(() => expect(quoteBodies(spy).at(-1)).toMatchObject({ shipWave: "spring", zip: "55401" }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(screen.queryByRole("button", { name: /Switch this order/ })).toBeNull();
      const orderType = screen.getByTestId("order-type");
      expect(orderType.textContent).toBe("Pre-order · spring wave · $10 deposit today, balance when your trees ship");
      expect(document.activeElement).toBe(orderType);
      expect(submits().every((b) => !b.disabled)).toBe(true);
    });

    it("shows the reason and keeps submit blocked when spring is closed too (no switch offered)", async () => {
      seed([line(1, "fall")]);
      zoneBackend({ springOpen: false });
      renderCheckout();
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText(/ZIP/), "55401");
      expect((await screen.findByRole("alert")).textContent).toBe(CLOSED_FALL);
      expect(screen.queryByRole("button", { name: /Switch this order/ })).toBeNull();
      expect(submits().every((b) => b.disabled)).toBe(true);
    });

    it("does not send the ZIP for farm pickup", async () => {
      seed([line(1, "fall")]);
      const spy = zoneBackend();
      renderCheckout();
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText(/ZIP/), "55401");
      await waitFor(() => expect(quoteBodies(spy).at(-1)).toMatchObject({ zip: "55401" }));
      await user.click(screen.getByRole("radio", { name: /pick/i }));
      await waitFor(() => expect(quoteBodies(spy).at(-1)).toMatchObject({ fulfillment: "pickup" }));
      expect("zip" in quoteBodies(spy).at(-1)!).toBe(false);
    });

    it("blocks submit while the ZIP's quote is pending, so the ZIP-less quote can't carry a submit", async () => {
      seed([line(1, "fall")]);
      const spy = zoneBackend();
      renderCheckout();
      const user = userEvent.setup();
      await screen.findByLabelText(/Full name/);
      // The ZIP-less quote confirms fall: submit opens.
      await waitFor(() => expect(submits().every((b) => !b.disabled)).toBe(true));
      await user.type(screen.getByLabelText(/ZIP/), "55401");
      // Same tick as the ZIP completing: the debounced re-quote has not even
      // been sent, and the stale fall confirmation must not count.
      expect(quoteBodies(spy).some((b) => b.zip === "55401")).toBe(false);
      expect(submits().every((b) => b.disabled)).toBe(true);
      // Then the ZIP's own answer lands: fall is closed there.
      expect((await screen.findByRole("alert")).textContent).toBe(CLOSED_FALL);
      expect(submits().every((b) => b.disabled)).toBe(true);
    });

    it("reopens submit once the ZIP's quote confirms the wave", async () => {
      seed([line(1, "fall")]);
      zoneBackend();
      renderCheckout();
      const user = userEvent.setup();
      await screen.findByLabelText(/Full name/);
      await waitFor(() => expect(submits().every((b) => !b.disabled)).toBe(true));
      await user.type(screen.getByLabelText(/ZIP/), "24701");
      expect(submits().every((b) => b.disabled)).toBe(true);
      await waitFor(() => expect(submits().every((b) => !b.disabled)).toBe(true));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("says why when a 400 quote refusal carries no usable reason", async () => {
    seed([line(1, "fall")]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: { code: "closed" } }, 400));
    render(
      <CartProvider>
        <CheckoutPage depositQuoteHref="/api/cart/quote" />
      </CartProvider>,
    );
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByRole("alert")).textContent).toBe(QUOTE_REFUSED_FALLBACK);
    expect(submits().every((b) => b.disabled)).toBe(true);
  });
});
