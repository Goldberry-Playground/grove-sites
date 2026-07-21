import { describe, it, expect } from "vitest";
import {
  cultivarOptions,
  formatOptions,
  pickVariant,
  stripVariantCode,
  type SelectableVariant,
} from "./variant-select";

const V: SelectableVariant[] = [
  { id: 1, cultivar: "Honeycrisp", format: "Potted" },
  { id: 2, cultivar: "Honeycrisp", format: "Bareroot" },
  { id: 3, cultivar: "Fuji", format: "Potted" },
];

describe("cultivarOptions", () => {
  it("returns distinct cultivars in order", () => {
    expect(cultivarOptions(V)).toEqual(["Honeycrisp", "Fuji"]);
  });
  it("drops null cultivars (single-cultivar product)", () => {
    expect(cultivarOptions([{ id: 9, cultivar: null, format: "Potted" }])).toEqual([]);
  });
});

describe("formatOptions", () => {
  it("scopes formats to the chosen cultivar", () => {
    expect(formatOptions(V, "Honeycrisp")).toEqual(["Potted", "Bareroot"]);
    expect(formatOptions(V, "Fuji")).toEqual(["Potted"]);
  });
  it("spans all variants when cultivar is null", () => {
    expect(formatOptions(V, null)).toEqual(["Potted", "Bareroot"]);
  });
});

describe("pickVariant", () => {
  it("matches both axes", () => {
    expect(pickVariant(V, { cultivar: "Honeycrisp", format: "Bareroot" })?.id).toBe(2);
  });
  it("falls back to the cultivar's first variant when the format is unavailable", () => {
    expect(pickVariant(V, { cultivar: "Fuji", format: "Bareroot" })?.id).toBe(3);
  });
  it("falls back to the first variant when nothing matches", () => {
    expect(pickVariant(V, { cultivar: "Gala" })?.id).toBe(1);
  });
  it("returns undefined for an empty list", () => {
    expect(pickVariant([], { cultivar: "x" })).toBeUndefined();
  });
});

describe("stripVariantCode", () => {
  it("removes a leading [SKU] prefix (never shown to customers)", () => {
    expect(stripVariantCode("[FIG-AJ-BR] Fig (Adriatic JH, Bareroot)")).toBe(
      "Fig (Adriatic JH, Bareroot)",
    );
  });
  it("leaves names without a code prefix unchanged", () => {
    expect(stripVariantCode("Fig (Adriatic JH, Bareroot)")).toBe("Fig (Adriatic JH, Bareroot)");
  });
  it("strips only the leading token, keeping later brackets", () => {
    expect(stripVariantCode("[GN-APL-001] Honeycrisp [M.111]")).toBe("Honeycrisp [M.111]");
  });
});
