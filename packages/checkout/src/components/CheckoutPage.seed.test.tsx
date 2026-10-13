// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { CheckoutPage } from "./CheckoutPage";
import { CartProvider } from "../cart-store";
import type { CartSeedReservation } from "../seed";

vi.mock("@grove/analytics", () => ({ trackBeginCheckout: vi.fn() }));

/**
 * GOL-3258 follow-up (Josh rulings 2026-10-13): a seed cart follows the harvest
 * year the backend quotes at checkout, not the one stamped at add-to-cart; a
 * seed-only cart ships to the lower 48 + DC; nothing on a seed checkout names a
 * handling fee or the $10 tree deposit.
 */
const SEED_2026: CartSeedReservation = { year: 2026, rolledOver: false, shipStart: "2026-10-15", shipEnd: "2026-11-15" };
const seedLine = (variantId: number, seed: CartSeedReservation = SEED_2026) => ({
  variantId,
  templateId: 300,
  name: `Allegheny Chinquapin seed nuts (Pack of ${variantId === 901 ? 20 : 50})`,
  price: variantId === 901 ? 14 : 30,
  imageUrl: "",
  quantity: 1,
  seed,
});
const treeLine = { variantId: 1, templateId: 1, name: "Tree", price: 12, imageUrl: "", quantity: 1 };
const seedCart = (lines: unknown[]) => window.localStorage.setItem("grove-cart-v1", JSON.stringify(lines));
const storedCart = () => JSON.parse(window.localStorage.getItem("grove-cart-v1") ?? "[]");
const json = (body: unknown, status = 200): Response =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const submits = () => screen.getAllByRole("button", { name: /Continue to payment/ }) as HTMLButtonElement[];
const stateOptions = () =>
  Array.from((screen.getByLabelText(/State/) as HTMLSelectElement).options).map((o) => o.value);

function renderCheckout() {
  return render(
    <CartProvider>
      <CheckoutPage depositQuoteHref="/api/cart/quote" />
    </CartProvider>,
  );
}

describe("<CheckoutPage /> seed cart — harvest year decided by the backend quote (spec §6)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("rollover: add Oct 30 for fall 2026, quote on Nov 2 books fall 2027 — the page says 2027, explains, and holds submit until confirmed", async () => {
    seedCart([seedLine(901), seedLine(902)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2027 }),
    );
    renderCheckout();
    await screen.findByLabelText(/Full name/);

    // The notice: what moved, why, what the $1 reserves now, and the way out.
    const notice = await screen.findByTestId("seed-harvest-moved");
    expect(notice.getAttribute("role")).toBe("alert");
    expect(notice.textContent).toBe(
      "Your seed reservation moved to the fall 2027 harvest. Fall 2026 pre-orders closed before you checked out, so your $1 deposit now reserves seeds from the fall 2027 harvest, shipping approx Oct 15 to Nov 15. Confirm to continue, or remove the seeds from your cart.",
    );
    // The order-type line and the stored lines already say the NEW year: no
    // surface still claims fall 2026 while the backend books 2027.
    expect(screen.getByTestId("order-type").textContent).toBe(
      "Seed pre-order · fall 2027 harvest · $1 deposit today, the rest when it ships",
    );
    // localStorage is written by a passive effect after the commit the notice
    // appeared in, so poll it rather than read it on the same tick.
    await waitFor(() =>
      expect(storedCart().map((l: { seed: unknown }) => l.seed)).toEqual([
        { year: 2027, rolledOver: true, shipStart: "2027-10-15", shipEnd: "2027-11-15", movedFromYear: 2026 },
        { year: 2027, rolledOver: true, shipStart: "2027-10-15", shipEnd: "2027-11-15", movedFromYear: 2026 },
      ]),
    );
    expect(submits().every((b) => b.disabled)).toBe(true);

    // Confirming clears the notice, keeps the new year and reopens submit.
    fireEvent.click(screen.getByRole("button", { name: "Continue with the fall 2027 harvest" }));
    await waitFor(() => expect(screen.queryByTestId("seed-harvest-moved")).toBeNull());
    await waitFor(() =>
      expect(storedCart().map((l: { seed: { year: number; movedFromYear?: number } }) => [l.seed.year, l.seed.movedFromYear])).toEqual([
        [2027, undefined],
        [2027, undefined],
      ]),
    );
    expect(screen.getByTestId("order-type").textContent).toContain("fall 2027 harvest");
    expect(submits().every((b) => !b.disabled)).toBe(true);
  });

  it("same year as stored: no notice, submit open, nothing rewritten", async () => {
    seedCart([seedLine(901)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2026 }),
    );
    renderCheckout();
    await screen.findByLabelText(/Full name/);
    await waitFor(() => expect(submits().every((b) => !b.disabled)).toBe(true));
    expect(screen.queryByTestId("seed-harvest-moved")).toBeNull();
    expect(storedCart()[0].seed).toEqual(SEED_2026);
  });

  it("the storefront's own estimate carries no year and moves nothing; submit stays held as before", async () => {
    seedCart([seedLine(901)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ depositNow: true, depositReason: "seed", amountDueToday: 1, estimated: true }),
    );
    renderCheckout();
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "We could not confirm your pre-order deposit. Please try again shortly.",
    );
    expect(screen.queryByTestId("seed-harvest-moved")).toBeNull();
    expect(storedCart()[0].seed).toEqual(SEED_2026);
    expect(submits().every((b) => b.disabled)).toBe(true);
  });

  it("a cart reloaded mid-move still shows the notice and holds submit until confirmed", async () => {
    seedCart([seedLine(901, { ...SEED_2026, year: 2027, rolledOver: true, shipStart: "2027-10-15", shipEnd: "2027-11-15", movedFromYear: 2026 })]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2027 }),
    );
    renderCheckout();
    await screen.findByLabelText(/Full name/);
    expect((await screen.findByTestId("seed-harvest-moved")).textContent).toMatch(/moved to the fall 2027 harvest/);
    expect(submits().every((b) => b.disabled)).toBe(true);
  });
});

describe("<CheckoutPage /> seed cart — ship-to list and copy (Josh, 2026-10-13)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("a seed-only cart may ship to the lower 48 + DC, never Hawaii or Alaska", async () => {
    seedCart([seedLine(901)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2026 }),
    );
    renderCheckout();
    await screen.findByLabelText(/Full name/);
    await screen.findByTestId("order-type");
    const codes = stateOptions();
    for (const west of ["CA", "WA", "OR", "TX", "DC"]) expect(codes).toContain(west);
    expect(codes).not.toContain("HI");
    expect(codes).not.toContain("AK");
    expect(codes.filter((c) => c !== "")).toHaveLength(49);
    expect(
      screen.getByText("We ship seeds to the lower 48 states and Washington, DC. We can't ship seeds to Hawaii or Alaska."),
    ).toBeTruthy();
  });

  it("a tree cart keeps the 32-state live-tree list", async () => {
    seedCart([treeLine]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ depositNow: false, amountDueToday: null }));
    renderCheckout();
    await screen.findByLabelText(/Full name/);
    const codes = stateOptions();
    expect(codes).toContain("WV");
    expect(codes).not.toContain("CA");
    expect(codes.filter((c) => c !== "")).toHaveLength(32);
    expect(screen.getByText(/We currently ship live trees to 32 states/)).toBeTruthy();
  });

  it("names the $1 seed deposit, never a handling fee or the $10 tree deposit", async () => {
    seedCart([seedLine(901), seedLine(902)]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ depositNow: true, depositReason: "seed", amountDueToday: 1, seedHarvestYear: 2026 }),
    );
    const { container } = renderCheckout();
    await screen.findByLabelText(/Full name/);
    await screen.findByText("Due today (seed deposit)");
    const text = container.textContent ?? "";
    expect(text).toContain("due today · balance when your seeds ship");
    expect(text).not.toContain("your trees ship");
    expect(text).toContain("Flat $1 deposit per order on seed reservations");
    expect(text).toContain("plus shipping and tax");
    expect(text).not.toMatch(/handling/i);
    expect(text).not.toMatch(/\$10\b/);
    expect(text).not.toContain("You will not be charged today");
    // The seed-owned copy carries no em dash (listing style rules). The page's
    // pre-existing Stripe trust line and pickup radio labels keep theirs; they
    // are board-approved brand copy and not this surface's to redline.
    for (const seedCopy of [
      screen.getByTestId("order-type").textContent,
      screen.getByText(/Flat \$1 deposit per order on seed reservations/).textContent,
      screen.getByText(/This is a seed pre-order/).textContent,
      screen.getByText(/We ship seeds to the lower 48/).textContent,
    ]) {
      expect(seedCopy).not.toContain("—");
    }
  });
});
