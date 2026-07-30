import { describe, it, expect } from "vitest";
import {
  ZONE_BY_STATE,
  estimateShipping,
  shipsTo,
  tierFor,
  resolveRateTable,
  ZONE_RATE_TABLE,
} from "./shipping-estimate";

describe("shipping-estimate zone map", () => {
  it("covers exactly the 21 green states", () => {
    expect(Object.keys(ZONE_BY_STATE).length).toBe(21);
  });

  it("keeps WV in the nearest zone (zone_1)", () => {
    expect(ZONE_BY_STATE.WV).toBe("zone_1");
    expect(ZONE_BY_STATE.ME).toBe("zone_5");
  });
});

describe("shipsTo", () => {
  it("true for a green state, case/space-insensitive", () => {
    expect(shipsTo("OH")).toBe(true);
    expect(shipsTo(" oh ")).toBe(true);
  });
  it("false for an ungreen state, empty, or null", () => {
    expect(shipsTo("CA")).toBe(false);
    expect(shipsTo("")).toBe(false);
    expect(shipsTo(null)).toBe(false);
  });
});

describe("tierFor", () => {
  it("prefers the server tier", () => {
    expect(tierFor({ shippingTier: "bareroot" })).toBe("bareroot");
    expect(tierFor({ shippingTier: "potted" })).toBe("potted");
  });
  it("sniffs the Format axis when the tier is missing", () => {
    expect(tierFor({ format: "Bare Root" })).toBe("bareroot");
    expect(tierFor({ format: "Bareroot" })).toBe("bareroot");
  });
  it("defaults to potted (never undercharge)", () => {
    expect(tierFor({ format: "Potted 12\"" })).toBe("potted");
    expect(tierFor({})).toBe("potted");
  });
});

describe("estimateShipping", () => {
  it("prices a green state per zone and tier", () => {
    // WV = zone_1: bareroot 21, potted 32
    expect(estimateShipping("WV", "bareroot")).toBe(21);
    expect(estimateShipping("WV", "potted")).toBe(32);
    // ME = zone_5: bareroot 25, potted 40
    expect(estimateShipping("ME", "potted")).toBe(40);
  });

  it("returns null for an ineligible state (never a guessed charge)", () => {
    expect(estimateShipping("CA", "potted")).toBeNull();
    expect(estimateShipping("", "potted")).toBeNull();
    expect(estimateShipping(null, "bareroot")).toBeNull();
  });

  it("honours a fetched rate table override", () => {
    const live = { zone_1: { potted: { base: 99 } } };
    expect(estimateShipping("WV", "potted", live)).toBe(99);
    // tier missing in the override → null, not a fallback to the snapshot
    expect(estimateShipping("WV", "bareroot", live)).toBeNull();
  });
});

describe("resolveRateTable", () => {
  it("uses the fetched table when non-empty, else the snapshot", () => {
    const live = { zone_1: { potted: { base: 99 } } };
    expect(resolveRateTable(live)).toBe(live);
    expect(resolveRateTable(null)).toBe(ZONE_RATE_TABLE);
    expect(resolveRateTable({})).toBe(ZONE_RATE_TABLE);
  });
});
