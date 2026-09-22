// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { trackEvent } from "@grove/analytics";
import { CheckoutPage } from "./CheckoutPage";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";

vi.mock("@grove/analytics", () => ({
  trackBeginCheckout: vi.fn(),
  trackEvent: vi.fn(),
}));

// $60 cart: 2 × $30 pears.
function seedCart(quantity = 2) {
  window.localStorage.setItem(
    "grove-cart-v1",
    JSON.stringify([
      { variantId: 51, templateId: 5, name: "Pear (Bartlett, Bareroot)", price: 30, imageUrl: "", quantity },
    ]),
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const NO_PROMO = { ok: true, applied: null, code: null, discountAmount: 0, subtotalAfter: 60, message: null, tier: null };

interface Routes {
  promo?: (body: Record<string, unknown>) => Response;
  tiers?: () => Response;
  quote?: () => Response;
}

/** Route the page's fetches by URL; records every call. */
function mockFetch(routes: Routes) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "/api/checkout/promo") return (routes.promo ?? (() => json(NO_PROMO)))(body);
    if (url === "/api/cart/tiers") return (routes.tiers ?? (() => json({ tiers: [], qualifyingUnits: null })))();
    if (url === "/api/cart/quote") return (routes.quote ?? (() => json({ depositNow: false, depositReason: null, amountDueToday: null })))();
    if (url === "/api/checkout/session") return json({ error: "session should not be called" }, 500);
    throw new Error(`unexpected fetch ${url}`);
  });
}

function promoCalls(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls
    .filter(([u]) => String(u) === "/api/checkout/promo")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

function renderCheckout() {
  return render(
    <CartProvider>
      <CheckoutPage
        depositQuoteHref="/api/cart/quote"
        promoPreviewHref="/api/checkout/promo"
        tiersHref="/api/cart/tiers"
      />
    </CartProvider>,
  );
}

const summary = () => screen.getByRole("heading", { name: "Your Order" }).closest("aside") as HTMLElement;

describe("<CheckoutPage /> — promo Apply + discount preview (GOL-2432)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(trackEvent).mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("Apply shows one 'Discount' row (FLATWOODS, −$10.00) and no client-side tax", async () => {
    seedCart();
    const spy = mockFetch({
      promo: (b) =>
        json(
          b.promoCode === "FLATWOODS"
            ? { ...NO_PROMO, applied: "code", code: "FLATWOODS", discountAmount: 10, subtotalAfter: 50, message: "FLATWOODS applied" }
            : NO_PROMO,
        ),
    });
    renderCheckout();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Promo code"), "flatwoods");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const row = (await within(summary()).findByText("FLATWOODS applied")).closest(
      ".grove-checkout__summary-row",
    )!;
    expect(row.querySelector("dt")!.textContent).toMatch(/^Discount/);
    expect(row.textContent).toContain("−$10.00");
    // Josh's ruling (2026-09-22): rows in order Discount, Shipping, Sales tax,
    // then the figure; tax is the backend's line on Review & pay, never
    // estimated here. $60 − $10 = $50 subtotal.
    const labels = [...summary().querySelectorAll(".grove-checkout__summary-list dt")].map(
      (dt) => dt.firstChild?.textContent,
    );
    expect(labels).toEqual(["Discount", "Shipping", "Sales tax", "Subtotal"]);
    expect(within(summary()).getByText("$50.00")).toBeTruthy();
    expect(within(summary()).queryByText("$3.50")).toBeNull();
    expect(within(summary()).getByText(/The discount is applied on the secure payment page/)).toBeTruthy();

    const last = promoCalls(spy).at(-1)!;
    expect(last).toEqual({ items: [{ variantId: 51, quantity: 2 }], fulfillment: "ship", promoCode: "FLATWOODS" });
  });

  it("shows the backend's coupon-specific message verbatim under the field on failure", async () => {
    seedCart(1);
    const msg = "FLATWOODS needs 2 qualifying trees (apple, pear or plum); you have 1. Add 1 more.";
    mockFetch({ promo: (b) => json(b.promoCode ? { ...NO_PROMO, ok: false, message: msg } : NO_PROMO) });
    renderCheckout();
    const user = userEvent.setup();
    const field = await screen.findByLabelText("Promo code");
    await user.type(field, "FLATWOODS");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(msg);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(within(summary()).queryByText(/applied$/)).toBeNull();

    // Editing the code clears the stale message.
    await user.type(field, "X");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Enter in the code field applies the code and never submits the order", async () => {
    seedCart();
    const spy = mockFetch({
      promo: (b) =>
        json(b.promoCode ? { ...NO_PROMO, applied: "code", code: "FLATWOODS", discountAmount: 10, subtotalAfter: 50 } : NO_PROMO),
    });
    renderCheckout();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Promo code"), "FLATWOODS{Enter}");

    expect(await within(summary()).findByText("FLATWOODS applied")).toBeTruthy();
    expect(promoCalls(spy).some((b) => b.promoCode === "FLATWOODS")).toBe(true);
    expect(spy.mock.calls.some(([u]) => String(u) === "/api/checkout/session")).toBe(false);
  });

  it("shows the volume tier row and the reason when the tier beats the typed code", async () => {
    seedCart(10); // 10 × $30 = $300
    const reason = "Your 20% volume discount is worth more than FLATWOODS, so we applied that.";
    mockFetch({
      promo: (b) =>
        json({
          ...NO_PROMO,
          applied: "tier",
          discountAmount: 60,
          subtotalAfter: 240,
          tier: { minQty: 10, percent: 20 },
          message: b.promoCode ? reason : "20% volume discount applied",
        }),
      tiers: () =>
        json({ tiers: [{ minQty: 5, percent: 10, label: "" }, { minQty: 10, percent: 20, label: "" }], qualifyingUnits: 10 }),
    });
    renderCheckout();

    // The automatic tier shows without typing a code (no reason line yet).
    const row = (await within(summary()).findByText("Volume discount (20% for 10+ trees)")).closest(
      ".grove-checkout__summary-row",
    )!;
    expect(row.textContent).toContain("−$60.00");
    expect(screen.queryByText(reason)).toBeNull();
    expect(await within(summary()).findByText("20% off unlocked")).toBeTruthy();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Promo code"), "FLATWOODS");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await within(summary()).findByText(new RegExp(reason))).toBeTruthy();
    expect(within(summary()).getByText("Volume discount (20% for 10+ trees)")).toBeTruthy();
  });

  it("shows the nudge on a ships-now cart and tracks tier_nudge_shown once", async () => {
    seedCart(4);
    mockFetch({
      tiers: () => json({ tiers: [{ minQty: 5, percent: 10, label: "" }, { minQty: 10, percent: 20, label: "" }], qualifyingUnits: 4 }),
    });
    renderCheckout();
    expect(await within(summary()).findByText("Add 1 more tree to unlock 10% off")).toBeTruthy();
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith("tier_nudge_shown", { surface: "checkout", state: "locked", percent: 0, units: 4 }),
    );
    expect(vi.mocked(trackEvent).mock.calls.filter(([n]) => n === "tier_nudge_shown")).toHaveLength(1);
  });

  it("deposit cart: hides the nudge and shows the backend's code refusal", async () => {
    seedCart(4);
    const refusal = "Promo codes apply to orders that ship now. Your cart is a reservation, so no code can be used.";
    mockFetch({
      quote: () => json({ depositNow: true, depositReason: "sold-out", amountDueToday: 10 }),
      tiers: () => json({ tiers: [{ minQty: 5, percent: 10, label: "" }], qualifyingUnits: 4 }),
      promo: () => json({ error: refusal }, 400),
    });
    renderCheckout();
    expect(await screen.findByText("Due today (reservation deposit)")).toBeTruthy();
    // Give the tiers fetch time to land; the nudge must still not render.
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText(/unlock/)).toBeNull();
    expect(trackEvent).not.toHaveBeenCalledWith("tier_nudge_shown", expect.anything());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Promo code"), "FLATWOODS");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect((await screen.findByRole("alert")).textContent).toContain(refusal);
    expect(within(summary()).queryByText(/applied$/)).toBeNull();
  });

  it("quote fails: never flashes the nudge on a cart whose charge mode is unknown", async () => {
    // The tiers feed says this cart qualifies, but the deposit quote errors, so
    // we can't know it ships now. The nudge must stay closed (fail-closed): a
    // reservation cart earns no discount (GOL-2088), and a discount promise on
    // one it can't honour is worse than showing nothing.
    seedCart(4);
    mockFetch({
      quote: () => json({ error: "quote down" }, 500),
      tiers: () => json({ tiers: [{ minQty: 5, percent: 10, label: "" }], qualifyingUnits: 4 }),
    });
    renderCheckout();
    // Let both debounced fetches resolve; the nudge must never appear.
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText(/unlock/)).toBeNull();
    expect(trackEvent).not.toHaveBeenCalledWith("tier_nudge_shown", expect.anything());
  });
});

describe("<CartPage /> — volume nudge (GOL-2432)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("renders the partial-tier nudge from the tiers route", async () => {
    seedCart(5);
    mockFetch({
      tiers: () => json({ tiers: [{ minQty: 5, percent: 10, label: "" }, { minQty: 10, percent: 20, label: "" }], qualifyingUnits: 5 }),
    });
    render(
      <CartProvider>
        <CartPage depositQuoteHref="/api/cart/quote" tiersHref="/api/cart/tiers" />
      </CartProvider>,
    );
    const nudge = await screen.findByRole("status");
    expect(nudge.textContent).toBe("10% off unlocked — add 5 more for 20%");
  });
});
