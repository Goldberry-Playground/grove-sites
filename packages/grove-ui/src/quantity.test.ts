import { describe, it, expect } from "vitest";

import { clampQuantity } from "./quantity";

describe("clampQuantity (GOL-1055)", () => {
  it("keeps a valid positive integer", () => {
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(12)).toBe(12);
  });

  it("floors a fractional value to an integer", () => {
    expect(clampQuantity(1.5)).toBe(1);
    expect(clampQuantity(3.99)).toBe(3);
  });

  it("never returns below the minimum (default 1)", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
  });

  it("coerces NaN / non-finite to the minimum — no NaN escapes", () => {
    expect(clampQuantity(Number.NaN)).toBe(1);
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(1);
    expect(Number.isNaN(clampQuantity(Number.NaN))).toBe(false);
  });

  it("honours a custom min and an optional max ceiling", () => {
    expect(clampQuantity(0, 2)).toBe(2);
    expect(clampQuantity(50, 1, 9999)).toBe(50);
    expect(clampQuantity(10_000, 1, 9999)).toBe(9999);
  });
});
