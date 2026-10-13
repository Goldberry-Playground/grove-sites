import { describe, expect, it } from "vitest";
import { dueTodayFor } from "./due-today";
import {
  MIXED_CART_MESSAGE,
  depositConfirmedFor,
  mixedCartMessage,
  orderTypeLine,
  seedDepositConfirmed,
} from "./order-type";
import {
  SEED_MIXED_MESSAGE,
  formatIsoMonthDay,
  seedLineNotes,
  seedReservationLabel,
  seedShipWindow,
} from "./seed";
import type { CartItem } from "./cart-reducer";

const SEED = { year: 2026, rolledOver: false, shipStart: "2026-10-15", shipEnd: "2026-11-15" };
const seedQuote = { depositNow: true, depositReason: "seed" as const, amountDueToday: 1 };

describe("seed copy (GOL-3258)", () => {
  it("formats ISO dates by hand, never shifted by a time zone", () => {
    expect(formatIsoMonthDay("2026-10-15")).toBe("Oct 15");
    expect(formatIsoMonthDay("2026-11-01")).toBe("Nov 1");
    expect(formatIsoMonthDay("soon")).toBe("soon");
    expect(seedShipWindow(SEED)).toBe("Oct 15 to Nov 15");
  });

  it("labels the harvest Reserved in season and Pre-ordered once rolled over", () => {
    expect(seedReservationLabel(SEED)).toBe("Reserved, fall 2026 harvest");
    expect(seedReservationLabel({ year: 2027, rolledOver: true })).toBe("Pre-ordered, fall 2027 harvest");
    expect(seedLineNotes(SEED)).toEqual(["Reserved, fall 2026 harvest", "Ships approx Oct 15 to Nov 15"]);
  });

  it("order-type line names the harvest and the $1 deposit", () => {
    expect(orderTypeLine({ kind: "seed", wave: null, depositNow: true, pickup: null, seed: SEED })).toBe(
      "Seed pre-order · fall 2026 harvest · $1 deposit today, the rest when it ships",
    );
  });

  it("due today is $1 with the balance spelled out", () => {
    expect(dueTodayFor(seedQuote, { subtotal: 30 })).toEqual({
      amount: 1,
      label: "Due today (seed deposit)",
      note: "This is a seed pre-order. You pay one flat $1.00 deposit today. $29.00 plus shipping and tax is charged when your order ships.",
      eyebrow: "seed pre-order",
    });
    expect(dueTodayFor(seedQuote)?.note).toContain("The rest of the pack price, plus shipping and tax, is charged");
  });

  it("only a backend quote that says seed confirms the seed deposit", () => {
    expect(seedDepositConfirmed(seedQuote)).toBe(true);
    expect(seedDepositConfirmed({ ...seedQuote, estimated: true })).toBe(false);
    expect(seedDepositConfirmed({ depositNow: false, depositReason: null, amountDueToday: null })).toBe(false);
    expect(seedDepositConfirmed({ ...seedQuote, depositReason: "preorder" })).toBe(false);
    expect(depositConfirmedFor("seed", null, null)).toBe(false);
    expect(depositConfirmedFor("immediate", null, null)).toBe(true);
  });

  it("a mixed cart holding a seed line gets the seed wording", () => {
    const tree = { variantId: 1, templateId: 1, name: "T", price: 1, imageUrl: "", quantity: 1 } satisfies CartItem;
    expect(mixedCartMessage([tree, { ...tree, variantId: 2, seed: SEED }])).toBe(SEED_MIXED_MESSAGE);
    expect(mixedCartMessage([tree, { ...tree, variantId: 2, wave: "fall" }])).toBe(MIXED_CART_MESSAGE);
  });

  it("no seed copy carries an em dash", () => {
    const all = [
      orderTypeLine({ kind: "seed", wave: null, depositNow: true, pickup: null, seed: SEED }),
      dueTodayFor(seedQuote, { subtotal: 30 })?.note,
      ...seedLineNotes(SEED),
      SEED_MIXED_MESSAGE,
    ].join(" ");
    expect(all).not.toContain("—");
  });
});
