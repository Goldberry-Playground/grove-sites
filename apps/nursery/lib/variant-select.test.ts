import { describe, it, expect } from "vitest";
import {
  cultivarOptions,
  formatOptions,
  rootstockOptions,
  rootstockKind,
  pickVariant,
  variantMatches,
  defaultCultivar,
  defaultFormat,
  defaultRootstock,
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

describe("variantMatches", () => {
  it("matches only when every provided axis agrees", () => {
    const v = { id: 2, cultivar: "Honeycrisp", format: "Bareroot", rootstock: "M.111" };
    expect(variantMatches(v, { cultivar: "Honeycrisp", format: "Bareroot" })).toBe(true);
    expect(variantMatches(v, { cultivar: "Honeycrisp", format: "Potted" })).toBe(false);
    expect(variantMatches(v, { rootstock: "Seedling" })).toBe(false);
  });
  it("treats null axes as don't-care and undefined variant as no match", () => {
    const v = { id: 1, cultivar: "Fuji", format: "Potted" };
    expect(variantMatches(v, { cultivar: null, format: null, rootstock: null })).toBe(true);
    expect(variantMatches(undefined, { cultivar: "Fuji" })).toBe(false);
  });
});

// Availability-aware fixture: the Apple prod scenario (GOL-1862). Potted is the
// blind formats[0] but is a dead pickup-only 0-stock SKU; Bareroot is buyable.
interface StockVariant extends SelectableVariant {
  buyable: boolean;
}
const APPLE: StockVariant[] = [
  { id: 100, cultivar: "Honeycrisp", format: "Potted", rootstock: "M.111", buyable: false },
  { id: 101, cultivar: "Honeycrisp", format: "Bareroot", rootstock: "M.111", buyable: true },
  { id: 102, cultivar: "Fuji", format: "Potted", rootstock: "M.111", buyable: false },
];
const buyable = (v: StockVariant | undefined) => v?.buyable === true;

describe("defaultFormat", () => {
  it("prefers the first purchasable format over a dead formats[0]", () => {
    // Honeycrisp: Potted (dead) is [0], Bareroot is buyable → open on Bareroot.
    expect(defaultFormat(APPLE, ["Potted", "Bareroot"], "Honeycrisp", buyable)).toBe("Bareroot");
  });
  it("degrades to the first format when every format is sold out", () => {
    // Fuji has only a dead Potted → nothing purchasable → today's behaviour.
    expect(defaultFormat(APPLE, ["Potted"], "Fuji", buyable)).toBe("Potted");
  });
  it("is null for an empty format list", () => {
    expect(defaultFormat(APPLE, [], "Honeycrisp", buyable)).toBeNull();
  });
});

describe("defaultCultivar", () => {
  it("skips a fully sold-out cultivar for one with a purchasable variant", () => {
    // Reorder so the dead Fuji sorts first; the picker still opens on Honeycrisp.
    expect(defaultCultivar(APPLE, ["Fuji", "Honeycrisp"], buyable)).toBe("Honeycrisp");
  });
  it("degrades to the first cultivar when none is purchasable", () => {
    const dead = APPLE.map((v) => ({ ...v, buyable: false }));
    expect(defaultCultivar(dead, ["Fuji", "Honeycrisp"], buyable)).toBe("Fuji");
  });
});

describe("defaultRootstock", () => {
  const ROOTS: StockVariant[] = [
    { id: 200, cultivar: "Honeycrisp", format: "Bareroot", rootstock: "M.111", buyable: false },
    { id: 201, cultivar: "Honeycrisp", format: "Bareroot", rootstock: "Seedling", buyable: true },
  ];
  it("prefers the first purchasable rootstock for the chosen cultivar+format", () => {
    expect(
      defaultRootstock(ROOTS, ["M.111", "Seedling"], "Honeycrisp", "Bareroot", buyable),
    ).toBe("Seedling");
  });
  it("degrades to the first rootstock when none is purchasable", () => {
    const dead = ROOTS.map((v) => ({ ...v, buyable: false }));
    expect(
      defaultRootstock(dead, ["M.111", "Seedling"], "Honeycrisp", "Bareroot", buyable),
    ).toBe("M.111");
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
