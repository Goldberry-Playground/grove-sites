import { describe, it, expect } from "vitest";
import { inferCompanions, zonesOverlap, type CompanionInput } from "./companions";

const c = (
  id: number,
  tags: string[],
  zoneMin?: number | null,
  zoneMax?: number | null,
): CompanionInput => ({ id, tags, zoneMin, zoneMax });

describe("zonesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(zonesOverlap({ zoneMin: 3, zoneMax: 7 }, { zoneMin: 6, zoneMax: 9 })).toBe(true);
  });
  it("rejects disjoint ranges", () => {
    expect(zonesOverlap({ zoneMin: 3, zoneMax: 5 }, { zoneMin: 7, zoneMax: 9 })).toBe(false);
  });
  it("treats missing bounds as open (never filters on a technicality)", () => {
    expect(zonesOverlap({ zoneMin: null, zoneMax: null }, { zoneMin: 7, zoneMax: 9 })).toBe(true);
  });
});

describe("inferCompanions", () => {
  const subject = c(1, ["apple", "pollinator-required"], 3, 7);

  it("returns tag-sharing, zone-overlapping candidates ranked by shared count", () => {
    const result = inferCompanions(subject, [
      c(2, ["apple", "pollinator-required"], 4, 8), // 2 shared
      c(3, ["apple"], 3, 6), // 1 shared
      c(4, ["nut"], 3, 7), // 0 shared → excluded
    ]);
    expect(result.map((r) => r.id)).toEqual([2, 3]);
  });

  it("excludes the subject itself", () => {
    expect(inferCompanions(subject, [c(1, ["apple"], 3, 7)])).toEqual([]);
  });

  it("excludes zone-disjoint candidates even when tags match", () => {
    expect(inferCompanions(subject, [c(5, ["apple"], 8, 10)])).toEqual([]);
  });

  it("caps at the limit", () => {
    const many = Array.from({ length: 6 }, (_, i) => c(i + 10, ["apple"], 3, 7));
    expect(inferCompanions(subject, many, 4)).toHaveLength(4);
  });

  it("returns nothing when the subject has no tags", () => {
    expect(inferCompanions(c(1, []), [c(2, ["apple"])])).toEqual([]);
  });
});
