import { describe, it, expect } from "vitest";
import {
  cultivarOptions,
  formatOptions,
  rootstockOptions,
  rootstockKind,
  pickVariant,
  stripVariantCode,
  type SelectableVariant,
} from "./variant-select";

const V: SelectableVariant[] = [
  { id: 1, cultivar: "Honeycrisp", format: "Potted" },
  { id: 2, cultivar: "Honeycrisp", format: "Bareroot" },
  { id: 3, cultivar: "Fuji", format: "Potted" },
];

// A product offering a real grafted-vs-seedling choice per cultivar.
const R: SelectableVariant[] = [
  { id: 10, cultivar: "Honeycrisp", format: "Potted", rootstock: "M.111" },
  { id: 11, cultivar: "Honeycrisp", format: "Potted", rootstock: "Seedling" },
  { id: 12, cultivar: "Liberty", format: "Potted", rootstock: "M.111" },
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

describe("rootstockOptions", () => {
  it("returns distinct rootstocks scoped to the chosen cultivar", () => {
    expect(rootstockOptions(R, "Honeycrisp")).toEqual(["M.111", "Seedling"]);
    expect(rootstockOptions(R, "Liberty")).toEqual(["M.111"]);
  });
  it("spans all variants when cultivar is null", () => {
    expect(rootstockOptions(R, null)).toEqual(["M.111", "Seedling"]);
  });
  it("is empty for a product with no rootstock axis (no selector rendered)", () => {
    expect(rootstockOptions(V, "Honeycrisp")).toEqual([]);
  });
});

describe("rootstockKind", () => {
  it("classes own-root / seedling / ungrafted values as seedling", () => {
    expect(rootstockKind("Seedling")).toBe("seedling");
    expect(rootstockKind("Own-root")).toBe("seedling");
    expect(rootstockKind("own root")).toBe("seedling");
    expect(rootstockKind("Ungrafted")).toBe("seedling");
  });
  it("classes a named clonal rootstock (and empty/unknown) as grafted", () => {
    expect(rootstockKind("M.111")).toBe("grafted");
    expect(rootstockKind("Grafted")).toBe("grafted");
    expect(rootstockKind(null)).toBe("grafted");
    expect(rootstockKind(undefined)).toBe("grafted");
  });
});

describe("pickVariant", () => {
  it("matches both axes", () => {
    expect(pickVariant(V, { cultivar: "Honeycrisp", format: "Bareroot" })?.id).toBe(2);
  });
  it("matches all three axes when a rootstock is selected", () => {
    expect(
      pickVariant(R, { cultivar: "Honeycrisp", format: "Potted", rootstock: "Seedling" })?.id,
    ).toBe(11);
  });
  it("falls back past an unavailable rootstock to the cultivar+format match", () => {
    // Liberty has no Seedling option → drop the rootstock axis, keep cultivar+format.
    expect(
      pickVariant(R, { cultivar: "Liberty", format: "Potted", rootstock: "Seedling" })?.id,
    ).toBe(12);
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
