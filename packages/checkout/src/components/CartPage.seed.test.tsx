// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";

/**
 * GOL-3258 follow-up (Josh rulings 2026-10-13): the cart page shows a harvest
 * year change before payment, and a deposit cart ($1 seed or $10 tree) never
 * says "You will not be charged today" beside its due-today row, not even
 * while the quote is loading.
 */
const SEED_2026 = { year: 2026, rolledOver: false, shipStart: "2026-10-15", shipEnd: "2026-11-15" };
const seedLine = { variantId: 901, templateId: 300, name: "Chinquapin (Pack of 20)", price: 14, imageUrl: "", quantity: 1, seed: SEED_2026 };
const treeLine = (wave?: string) => ({ variantId: 1, templateId: 1, name: "Tree", price: 12, imageUrl: "", quantity: 1, ...(wave ? { wave } : {}) });
const seedCart = (lines: unknown[]) => window.localStorage.setItem("grove-cart-v1", JSON.stringify(lines));
const storedCart = () => JSON.parse(window.localStorage.getItem("grove-cart-v1") ?? "[]");
const json = (body: unknown): Response => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const NOT_CHARGED = /You will not be charged today/;

function mockQuote(quote: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("tiers") ? json({ tiers: [{ minUnits: 5, percent: 10 }], qualifyingUnits: 1 }) : json(quote),
  );
}
const renderCart = () =>
  render(
    <CartProvider>
      <CartPage depositQuoteHref="/api/cart/quote" tiersHref="/api/cart/tiers" />
    </CartProvider>,
  );

describe("<CartPage /> seed cart — harvest year moved by the quote (spec §6)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the move, relabels the line Pre-ordered for the new year, and confirms in place", async () => {
    seedCart([seedLine]);
    mockQuote({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2027 });
    renderCart();
    const notice = await screen.findByTestId("seed-harvest-moved");
    expect(notice.textContent).toMatch(/^Your seed reservation moved to the fall 2027 harvest\. Fall 2026 pre-orders closed/);
    expect(screen.getByTestId("order-type").textContent).toContain("fall 2027 harvest");
    expect(screen.getByText("Pre-ordered, fall 2027 harvest")).toBeTruthy();
    expect(screen.getByText("Ships approx Oct 15 to Nov 15")).toBeTruthy();
    await waitFor(() =>
      expect(storedCart()[0].seed).toEqual({ year: 2027, rolledOver: true, shipStart: "2027-10-15", shipEnd: "2027-11-15", movedFromYear: 2026 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with the fall 2027 harvest" }));
    await waitFor(() => expect(screen.queryByTestId("seed-harvest-moved")).toBeNull());
    await waitFor(() => expect(storedCart()[0].seed.movedFromYear).toBeUndefined());
    expect(storedCart()[0].seed.year).toBe(2027);
    expect(screen.getByText("Pre-ordered, fall 2027 harvest")).toBeTruthy();
  });

  it("same year: no notice", async () => {
    seedCart([seedLine]);
    mockQuote({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2026 });
    renderCart();
    await screen.findByText("Due today (seed deposit)");
    expect(screen.queryByTestId("seed-harvest-moved")).toBeNull();
    expect(screen.getByText("Reserved, fall 2026 harvest")).toBeTruthy();
  });
});

describe("<CartPage /> deposit carts make one claim about today's charge (Josh, 2026-10-13)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("seed $1: no 'not charged today' line, even while the quote is still loading", async () => {
    seedCart([seedLine]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { container } = renderCart();
    await screen.findByTestId("order-type");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(container.textContent).toContain("No payment until we confirm");
    expect(container.textContent).not.toMatch(/handling/i);
  });

  it("seed $1: the due-today note and the trust strip are the only claims once quoted", async () => {
    seedCart([seedLine]);
    mockQuote({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2026 });
    const { container } = renderCart();
    await screen.findByText("Due today (seed deposit)");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(container.textContent).toContain("No payment until we confirm");
    expect(container.textContent).toContain("plus shipping and tax");
  });

  it("tree $10 pre-order: no 'not charged today' line while loading or once quoted", async () => {
    seedCart([treeLine("fall")]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    renderCart();
    await screen.findByTestId("order-type");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    cleanup();
    vi.restoreAllMocks();
    mockQuote({ depositNow: true, depositReason: "preorder", shipWave: "fall", amountDueToday: 10 });
    renderCart();
    await screen.findByText("Due today (pre-order deposit)");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
  });

  it("an immediate cart the backend prices as a reservation deposit drops the line too", async () => {
    seedCart([treeLine()]);
    mockQuote({ depositNow: true, depositReason: "sold-out", amountDueToday: 10 });
    renderCart();
    await screen.findByText("Due today (reservation deposit)");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
  });

  it("a charged-in-full cart keeps the line once the quote confirms it, not before", async () => {
    seedCart([treeLine()]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    renderCart();
    await screen.findByTestId("order-type");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    cleanup();
    vi.restoreAllMocks();
    mockQuote({ depositNow: false, amountDueToday: null });
    renderCart();
    await screen.findByText("Ships now or ready for pickup · charged in full");
    await waitFor(() => expect(screen.getByText(NOT_CHARGED)).toBeTruthy());
  });
});
