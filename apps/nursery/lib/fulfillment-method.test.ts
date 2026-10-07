import { describe, it, expect } from "vitest";
import type { ShippingCalendar, ShippingTier } from "@grove/odoo-client";
import {
  formatsForMethod,
  isPottedSeason,
  methodFormatLabel,
  POTTED_SEASON_FALLBACK,
} from "./fulfillment-method";

const utc = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d, 12));
const cal = {
  leafed_window: [
    [5, 1],
    [10, 15],
  ],
} as unknown as ShippingCalendar;
const tierOf = (f: string): ShippingTier =>
  /bare\s*-?\s*root/i.test(f) ? "bareroot" : "potted";

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
  const run = (
    f: string[],
    m: "ship" | "pickup",
    o: { pottedSeason: boolean; preorderSeason: boolean; pottedShips?: boolean },
  ) => formatsForMethod(f, m, tierOf, o);

  it("in season from Sep 1: potted (peat and bagged) then the bareroot pre-order, both methods", () => {
    const o = { pottedSeason: true, preorderSeason: true };
    expect(run(both, "ship", o)).toEqual(["Potted", "Bareroot"]);
    expect(run(both, "pickup", o)).toEqual(["Potted", "Bareroot"]);
  });

  it("in season before Sep 1: potted only, no pre-order", () => {
    const o = { pottedSeason: true, preorderSeason: false };
    expect(run(both, "ship", o)).toEqual(["Potted"]);
    expect(run(both, "pickup", o)).toEqual(["Potted"]);
  });

  it("after Oct 15: only the bareroot pre-order, both methods", () => {
    const o = { pottedSeason: false, preorderSeason: true };
    expect(run(both, "ship", o)).toEqual(["Bareroot"]);
    expect(run(both, "pickup", o)).toEqual(["Bareroot"]);
    // Jan to Apr: still the pre-order (spring wave), never potted.
    expect(run(both, "pickup", { pottedSeason: false, preorderSeason: false })).toEqual([
      "Bareroot",
    ]);
  });

  it("a potted-only product sells potted in season and nothing out of it", () => {
    expect(run(["Potted"], "ship", { pottedSeason: true, preorderSeason: true })).toEqual([
      "Potted",
    ]);
    expect(run(["Potted"], "pickup", { pottedSeason: false, preorderSeason: true })).toEqual([]);
  });

  it("drops shipped potted when the feed cannot ship it", () => {
    const o = { pottedSeason: true, preorderSeason: true, pottedShips: false };
    expect(run(both, "ship", o)).toEqual(["Bareroot"]);
    expect(run(both, "pickup", o)).toEqual(["Potted", "Bareroot"]);
  });

  it("returns nothing for a product without a Format axis", () => {
    expect(run([], "ship", { pottedSeason: true, preorderSeason: true })).toEqual([]);
  });
});

describe("methodFormatLabel", () => {
  it("names a shipped potted variant peat and bagged", () => {
    expect(methodFormatLabel("ship", "potted", "Potted")).toBe("Peat & bagged");
  });
  it("names the bareroot variant bareroot pre-order for both methods", () => {
    expect(methodFormatLabel("pickup", "bareroot", "Bareroot")).toBe("Bareroot pre-order");
    expect(methodFormatLabel("ship", "bareroot", "Bareroot")).toBe("Bareroot pre-order");
  });
  it("keeps the potted label for pickup", () => {
    expect(methodFormatLabel("pickup", "potted", "Potted")).toBe("Potted");
  });
});
