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
  acknowledgeSeedMove,
  formatIsoMonthDay,
  moveSeedReservation,
  seedHarvestConfirmLabel,
  seedHarvestMovedMessage,
  seedLineNotes,
  seedReservationLabel,
  seedShipWindow,
  shiftIsoYear,
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
      balanceNote: "balance when your seeds ship",
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

describe("harvest-year move before payment (GOL-3258, spec §6)", () => {
  it("shifts the whole reservation forward a year and remembers the year first shown", () => {
    const moved = moveSeedReservation(SEED, 2027);
    expect(moved).toEqual({
      year: 2027,
      rolledOver: true,
      shipStart: "2027-10-15",
      shipEnd: "2027-11-15",
      movedFromYear: 2026,
    });
    // A second move keeps the ORIGINAL year, so the notice names what the shopper saw.
    expect(moveSeedReservation(moved, 2028)).toMatchObject({ year: 2028, shipStart: "2028-10-15", movedFromYear: 2026 });
    // Same year = same object, nothing to show.
    expect(moveSeedReservation(SEED, 2026)).toBe(SEED);
  });

  it("a move back to the season first shown is in season again", () => {
    const rolled = { year: 2027, rolledOver: true, shipStart: "2027-10-15", shipEnd: "2027-11-15" };
    expect(moveSeedReservation(rolled, 2026)).toEqual({
      year: 2026,
      rolledOver: false,
      shipStart: "2026-10-15",
      shipEnd: "2026-11-15",
      movedFromYear: 2027,
    });
    expect(shiftIsoYear("soon", 1)).toBe("soon");
  });

  it("acknowledging clears the move and nothing else", () => {
    const moved = moveSeedReservation(SEED, 2027);
    expect(acknowledgeSeedMove(moved)).toEqual({ ...moved, movedFromYear: undefined });
    expect("movedFromYear" in acknowledgeSeedMove(moved)).toBe(false);
    expect(acknowledgeSeedMove(SEED)).toBe(SEED);
  });

  it("the notice says what moved, why, what the $1 reserves now, and the ways out", () => {
    const moved = moveSeedReservation(SEED, 2027);
    expect(seedHarvestMovedMessage(moved)).toBe(
      "Your seed reservation moved to the fall 2027 harvest. Fall 2026 pre-orders closed before you checked out, so your $1 deposit now reserves seeds from the fall 2027 harvest, shipping approx Oct 15 to Nov 15. Confirm to continue, or remove the seeds from your cart.",
    );
    expect(seedHarvestMovedMessage(moveSeedReservation({ ...SEED, year: 2027, rolledOver: true }, 2026))).toMatch(
      /^Your seed reservation moved to the fall 2026 harvest\. Room opened up in the fall 2026 harvest, so/,
    );
    expect(seedHarvestConfirmLabel(moved)).toBe("Continue with the fall 2027 harvest");
    for (const copy of [seedHarvestMovedMessage(moved), seedHarvestConfirmLabel(moved)]) {
      expect(copy).not.toContain("—");
      expect(copy).not.toMatch(/handling/i);
    }
  });

  it("seed copy never mentions a handling fee: the balance is goods plus the label plus tax (Josh, 2026-10-13)", () => {
    const copy = [
      dueTodayFor(seedQuote, { subtotal: 30 })?.note,
      dueTodayFor(seedQuote)?.note,
      orderTypeLine({ kind: "seed", wave: null, depositNow: true, pickup: null, seed: SEED }),
      ...seedLineNotes(SEED),
    ].join(" ");
    expect(copy).not.toMatch(/handling/i);
    expect(copy).toContain("plus shipping and tax");
  });
});
