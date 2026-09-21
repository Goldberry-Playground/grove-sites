import { describe, expect, it } from "vitest";

import { RESERVATION_DEPOSIT, resolveCartDeposit } from "./cart-deposit";

// Fixed decision dates, UTC (the rule compares month/day in UTC like the backend).
const SEP_20 = new Date("2026-09-20T12:00:00Z"); // before the Oct 15 cutover
const OCT_16 = new Date("2026-10-16T12:00:00Z"); // after the cutover

const soldOutBareroot = {
  variantId: 196,
  quantity: 1,
  shippingTier: "bareroot" as const,
  format: "Bareroot",
  qtyAvailable: 0,
  available: false,
};
const stockedBareroot = { ...soldOutBareroot, variantId: 198, qtyAvailable: 30, available: true };
const stockedPotted = {
  variantId: 195,
  quantity: 1,
  shippingTier: "potted" as const,
  format: "Potted",
  qtyAvailable: 5,
  available: true,
};

describe("resolveCartDeposit — sold-out bareroot trigger (GOL-2233)", () => {
  it("a sold-out bareroot line makes the whole cart one $10 deposit", () => {
    const q = resolveCartDeposit([soldOutBareroot, stockedPotted], { today: SEP_20 });
    expect(q.depositNow).toBe(true);
    expect(q.depositReason).toBe("sold-out");
    expect(q.amountDueToday).toBe(RESERVATION_DEPOSIT);
    expect(q.lines).toEqual([
      { variantId: 196, bareroot: true, soldOut: true },
      { variantId: 195, bareroot: false, soldOut: false },
    ]);
  });

  it("fires on a shortfall, not just zero stock (2 on hand, 3 ordered)", () => {
    const q = resolveCartDeposit([{ ...stockedBareroot, qtyAvailable: 2, quantity: 3 }], {
      today: SEP_20,
    });
    expect(q.depositReason).toBe("sold-out");
  });

  it("fires regardless of fulfillment — pickup reservations deposit too", () => {
    const q = resolveCartDeposit([soldOutBareroot], { today: SEP_20, fulfillment: "pickup" });
    expect(q.depositNow).toBe(true);
  });

  it("in-stock bareroot before the cutover ships now and charges in full", () => {
    const q = resolveCartDeposit([stockedBareroot], { today: SEP_20 });
    expect(q.depositNow).toBe(false);
    expect(q.depositReason).toBeNull();
    expect(q.amountDueToday).toBeNull();
  });

  it("a sold-out POTTED line never triggers the deposit (not reservable)", () => {
    const q = resolveCartDeposit([{ ...stockedPotted, qtyAvailable: 0, available: false }], {
      today: SEP_20,
    });
    expect(q.depositNow).toBe(false);
    expect(q.lines[0]).toEqual({ variantId: 195, bareroot: false, soldOut: false });
  });

  it("derives bareroot from the Format axis when the tier is missing", () => {
    const q = resolveCartDeposit(
      [{ variantId: 7, quantity: 1, shippingTier: null, format: "Bare-root", available: false }],
      { today: SEP_20 },
    );
    expect(q.lines[0].bareroot).toBe(true);
    expect(q.depositReason).toBe("sold-out");
  });

  it("falls back to the boolean `available` flag when no quantity is known", () => {
    const stocked = resolveCartDeposit(
      [{ variantId: 7, quantity: 4, shippingTier: "bareroot", available: true }],
      { today: SEP_20 },
    );
    expect(stocked.depositNow).toBe(false);
    const out = resolveCartDeposit(
      [{ variantId: 7, quantity: 1, shippingTier: "bareroot", available: false }],
      { today: SEP_20 },
    );
    expect(out.depositNow).toBe(true);
  });
});

describe("resolveCartDeposit — season cutover trigger (Oct 15, bareroot-ship only)", () => {
  it("after the cutover a shipped bareroot cart deposits even when stocked", () => {
    const q = resolveCartDeposit([stockedBareroot], { today: OCT_16 });
    expect(q.depositReason).toBe("off-season");
    expect(q.amountDueToday).toBe(RESERVATION_DEPOSIT);
  });

  it("unset fulfillment counts as ship", () => {
    const q = resolveCartDeposit([stockedBareroot], { today: OCT_16, fulfillment: null });
    expect(q.depositNow).toBe(true);
  });

  it("farm pickup charges in full year-round", () => {
    const q = resolveCartDeposit([stockedBareroot], { today: OCT_16, fulfillment: "pickup" });
    expect(q.depositNow).toBe(false);
  });

  it("a potted-only cart charges in full year-round", () => {
    const q = resolveCartDeposit([stockedPotted], { today: OCT_16 });
    expect(q.depositNow).toBe(false);
  });

  it("the cutover day itself is still 'before' (strictly after Oct 15)", () => {
    const q = resolveCartDeposit([stockedBareroot], { today: new Date("2026-10-15T23:00:00Z") });
    expect(q.depositNow).toBe(false);
  });

  it("honours an injected cutover", () => {
    const q = resolveCartDeposit([stockedBareroot], { today: SEP_20, depositCutover: [9, 1] });
    expect(q.depositReason).toBe("off-season");
  });

  it("sold-out outranks off-season as the stated reason (backend order)", () => {
    const q = resolveCartDeposit([soldOutBareroot], { today: OCT_16 });
    expect(q.depositReason).toBe("sold-out");
  });
});

describe("resolveCartDeposit — empty cart", () => {
  it("charges nothing and quotes no deposit", () => {
    const q = resolveCartDeposit([], { today: OCT_16 });
    expect(q).toEqual({ depositNow: false, depositReason: null, amountDueToday: null, lines: [] });
  });
});
