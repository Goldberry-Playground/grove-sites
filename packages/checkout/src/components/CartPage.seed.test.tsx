// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { CartPage } from "./CartPage";
import { CartProvider } from "../cart-store";

/**
 * GOL-3258 follow-up (Josh rulings 2026-10-13): the cart page shows a harvest
 * year change before payment, and a deposit cart ($1 seed or $10 tree) says
 * "$1 today, the rest when it ships." from the quoted amount in place of "You
 * will not be charged today" and "No payment until we confirm", never those
 * two, not even while the quote is loading.
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

describe("<CartPage /> deposit carts say what they charge today (Josh, 2026-10-13)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  const NO_PAYMENT = "No payment until we confirm";

  it("seed $1: nothing about today's charge while the quote is still loading", async () => {
    seedCart([seedLine]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { container } = renderCart();
    await screen.findByTestId("order-type");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(container.textContent).not.toContain(NO_PAYMENT);
    // No amount under the CTA or in the strip until the quote names it (the
    // order-type line's own seed sentence is separate copy, kept from #1045).
    expect(container.querySelector(".grove-cart__reassure")).toBeNull();
    expect(container.querySelector(".grove-cart__trust")?.textContent).not.toContain("today");
    expect(container.textContent).not.toMatch(/handling/i);
    // The strip keeps its other three badges; only the charge badge waits.
    expect(container.textContent).toContain("Arrive-alive guarantee");
  });

  it("seed $1: '$1 today, the rest when it ships.' under the CTA and in the trust strip once quoted", async () => {
    seedCart([seedLine]);
    mockQuote({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2026 });
    const { container } = renderCart();
    await screen.findByText("Due today (seed deposit)");
    const lines = await screen.findAllByText("$1 today, the rest when it ships.");
    expect(lines).toHaveLength(2);
    expect(container.querySelector(".grove-cart__reassure")?.textContent).toBe("$1 today, the rest when it ships.");
    expect(container.querySelector(".grove-cart__trust")?.textContent).toContain("$1 today, the rest when it ships.");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(container.textContent).not.toContain(NO_PAYMENT);
    expect(container.textContent).toContain("plus shipping and tax");
    expect(container.textContent).not.toContain("\u2014");
  });

  it("tree $10 pre-order: '$10 today, the rest when it ships.' once quoted, nothing while loading", async () => {
    seedCart([treeLine("fall")]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const first = renderCart();
    await screen.findByTestId("order-type");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(first.container.textContent).not.toContain(NO_PAYMENT);
    cleanup();
    vi.restoreAllMocks();
    mockQuote({ depositNow: true, depositReason: "preorder", shipWave: "fall", amountDueToday: 10 });
    const { container } = renderCart();
    await screen.findByText("Due today (pre-order deposit)");
    expect(await screen.findAllByText("$10 today, the rest when it ships.")).toHaveLength(2);
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(container.textContent).not.toContain(NO_PAYMENT);
  });

  it("the amount is the quote's amount_due_today, not a literal", async () => {
    seedCart([seedLine]);
    mockQuote({ depositNow: true, depositReason: "seed", amountDueToday: 2.5, seedHarvestYear: 2026 });
    renderCart();
    await screen.findByText("Due today (seed deposit)");
    expect(await screen.findAllByText("$2.50 today, the rest when it ships.")).toHaveLength(2);
  });

  it("an immediate cart the backend prices as a reservation deposit says $10 today too", async () => {
    seedCart([treeLine()]);
    mockQuote({ depositNow: true, depositReason: "sold-out", amountDueToday: 10 });
    const { container } = renderCart();
    await screen.findByText("Due today (reservation deposit)");
    expect(await screen.findAllByText("$10 today, the rest when it ships.")).toHaveLength(2);
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    expect(container.textContent).not.toContain(NO_PAYMENT);
  });

  it("a charged-in-full cart keeps both existing lines once the quote confirms it, not before", async () => {
    seedCart([treeLine()]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    renderCart();
    await screen.findByTestId("order-type");
    expect(screen.queryByText(NOT_CHARGED)).toBeNull();
    cleanup();
    vi.restoreAllMocks();
    mockQuote({ depositNow: false, amountDueToday: null });
    const { container } = renderCart();
    await screen.findByText("Ships now or ready for pickup · charged in full");
    await waitFor(() => expect(screen.getByText(NOT_CHARGED)).toBeTruthy());
    expect(container.textContent).toContain(NO_PAYMENT);
    expect(container.querySelector(".grove-cart__trust")?.textContent).not.toContain("today");
  });
});
