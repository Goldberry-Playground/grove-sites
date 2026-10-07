// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";

const line = (variantId: number, wave?: string) => ({
  variantId,
  templateId: variantId,
  name: `Tree ${variantId}`,
  price: 12,
  imageUrl: "/x.jpg",
  quantity: 1,
  ...(wave ? { wave } : {}),
});
const seed = (lines: unknown[]) => window.localStorage.setItem("grove-cart-v1", JSON.stringify(lines));
const json = (body: unknown): Response => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

function mockFetch(quote: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("tiers")
      ? json({ tiers: [{ minUnits: 5, percent: 10 }], qualifyingUnits: 1 })
      : json(quote),
  );
}
const renderCart = () =>
  render(
    <CartProvider>
      <CartPage depositQuoteHref="/api/cart/quote" tiersHref="/api/cart/tiers" />
    </CartProvider>,
  );

describe("<CartPage /> — order type and pre-order deposit", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("sends the wave, shows the deposit and no tier nudge for a waved cart", async () => {
    seed([line(1, "fall")]);
    const spy = mockFetch({ depositNow: true, depositReason: "preorder", shipWave: "fall", amountDueToday: 10 });
    renderCart();
    expect((await screen.findByTestId("order-type")).textContent).toBe(
      "Pre-order · fall wave · $10 deposit today, balance when your trees ship",
    );
    expect(await screen.findByText("Due today (pre-order deposit)")).toBeTruthy();
    const quoteCall = spy.mock.calls.find((c) => String(c[0]).includes("quote"))!;
    expect(JSON.parse(String((quoteCall[1] as RequestInit).body)).shipWave).toBe("fall");
    expect(screen.queryByText(/unlock/i)).toBeNull();
  });

  it("labels an immediate cart as charged in full", async () => {
    seed([line(1)]);
    mockFetch({ depositNow: false, amountDueToday: null });
    renderCart();
    expect((await screen.findByTestId("order-type")).textContent).toBe(
      "Ships now or ready for pickup · charged in full",
    );
  });

  it("labels a legacy (no wave) cart the backend prices as a deposit as a pre-order", async () => {
    seed([line(1)]);
    mockFetch({ depositNow: true, depositReason: "off-season", amountDueToday: 10 });
    renderCart();
    await waitFor(() =>
      expect(screen.getByTestId("order-type").textContent).toBe("Pre-order · $10 deposit today, balance when your trees ship"),
    );
  });

  it("shows the blocking message for a stale mixed cart", async () => {
    seed([line(1, "fall"), line(2)]);
    mockFetch({ depositNow: false });
    renderCart();
    expect((await screen.findByRole("alert")).textContent).toMatch(/^Pre-orders check out on their own/);
    expect(screen.queryByTestId("order-type")).toBeNull();
  });
});
