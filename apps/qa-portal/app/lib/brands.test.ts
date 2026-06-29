import { describe, expect, it } from "vitest";
import { BRANDS, BRAND_LABELS, isBrand } from "./brands";

describe("brands", () => {
  it("lists exactly the four brands", () => {
    expect([...BRANDS]).toEqual(["goldberry", "ggg", "nursery", "hub"]);
  });

  it("isBrand accepts known brands and rejects others", () => {
    expect(isBrand("goldberry")).toBe(true);
    expect(isBrand("ggg")).toBe(true);
    expect(isBrand("bogus")).toBe(false);
    expect(isBrand("")).toBe(false);
  });

  it("has a human label for every brand", () => {
    for (const b of BRANDS) {
      expect(typeof BRAND_LABELS[b]).toBe("string");
      expect(BRAND_LABELS[b].length).toBeGreaterThan(0);
    }
  });
});
