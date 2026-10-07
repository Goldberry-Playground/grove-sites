import { describe, it, expect } from "vitest";
import type { ShippingCalendar, ShippingTier } from "@grove/odoo-client";
import {
  formatsForMethod,
  isPottedSeason,
  methodFormatLabel,
  POTTED_SEASON_FALLBACK,
} from "./fulfillment-method";

const utc = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d, 12));
const cal = { leafed_window: [[5, 1], [10, 15]] } as unknown as ShippingCalendar;
const tierOf = (f: string): ShippingTier => (/bare\s*-?\s*root/i.test(f) ? "bareroot" : "potted");
const all = () => true;

describe("isPottedSeason", () => {
  it("is inclusive of both leafed_window endpoints", () => {
    expect(isPottedSeason(utc(5, 1), cal)).toBe(true);
    expect(isPottedSeason(utc(10, 15), cal)).toBe(true);
  });
  it("is false outside the window", () => {
    expect(isPottedSeason(utc(10, 16), cal)).toBe(false);
    expect(isPottedSeason(utc(4, 30), cal)).toBe(false);
    expect(isPottedSeason(utc(1, 10), cal)).toBe(false);
  });
  it("falls back to May 1 to Oct 15 with no calendar", () => {
    expect(POTTED_SEASON_FALLBACK).toEqual([
      [5, 1],
      [10, 15],
    ]);
    expect(isPottedSeason(utc(10, 7), null)).toBe(true);
    expect(isPottedSeason(utc(10, 16), undefined)).toBe(false);
  });
});

describe("formatsForMethod", () => {
  const both = ["Bareroot", "Potted"];

  it("ship never returns a potted format when a bareroot one exists", () => {
    expect(formatsForMethod(both, "ship", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual([
      "Bareroot",
    ]);
    expect(formatsForMethod(both, "ship", tierOf, { pottedSeason: false, isPurchasable: all })).toEqual([
      "Bareroot",
    ]);
  });

  it("ship keeps a potted-only product in season (shown as peat and bagged)", () => {
    expect(
      formatsForMethod(["Potted"], "ship", tierOf, { pottedSeason: true, isPurchasable: all }),
    ).toEqual(["Potted"]);
  });

  it("ship offers nothing for a potted-only product out of season", () => {
    expect(
      formatsForMethod(["Potted"], "ship", tierOf, { pottedSeason: false, isPurchasable: all }),
    ).toEqual([]);
  });

  it("pickup shows only potted in season when potted is purchasable", () => {
    expect(formatsForMethod(both, "pickup", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual([
      "Potted",
    ]);
  });

  it("pickup falls back to bareroot when potted is sold out in season", () => {
    const pottedSoldOut = (f: string) => tierOf(f) !== "potted";
    expect(
      formatsForMethod(both, "pickup", tierOf, { pottedSeason: true, isPurchasable: pottedSoldOut }),
    ).toEqual(["Bareroot"]);
  });

  it("pickup shows bareroot out of season", () => {
    expect(formatsForMethod(both, "pickup", tierOf, { pottedSeason: false, isPurchasable: all })).toEqual([
      "Bareroot",
    ]);
  });

  it("pickup keeps a potted-only product so the card can show sold out", () => {
    expect(
      formatsForMethod(["Potted"], "pickup", tierOf, {
        pottedSeason: false,
        isPurchasable: () => false,
      }),
    ).toEqual(["Potted"]);
  });

  it("returns nothing for a product without a Format axis", () => {
    expect(formatsForMethod([], "ship", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual([]);
  });
});

describe("methodFormatLabel", () => {
  it("names a shipped potted variant peat and bagged", () => {
    expect(methodFormatLabel("ship", "potted", "Potted")).toBe("Peat & bagged");
  });
  it("names a pickup bareroot variant bareroot pre-order", () => {
    expect(methodFormatLabel("pickup", "bareroot", "Peat & bagged")).toBe("Bareroot pre-order");
  });
  it("leaves every other combination alone", () => {
    expect(methodFormatLabel("ship", "bareroot", "Peat & bagged")).toBe("Peat & bagged");
    expect(methodFormatLabel("ship", "bareroot", "Bareroot")).toBe("Bareroot");
    expect(methodFormatLabel("pickup", "potted", "Potted")).toBe("Potted");
  });
});
