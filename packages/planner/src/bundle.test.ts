import { describe, expect, it } from "vitest";
import { applyBundle, coversLines } from "./bundle";
import { FIXTURE_BUNDLES, FIXTURE_PLANTS } from "./fixtures";
import type { PlanLine } from "./types";

const hazel = FIXTURE_PLANTS[3];
const redbud = FIXTURE_PLANTS[7];
const lines: PlanLine[] = [
  { plant: hazel, qty: 8, slot: "shrub", zoneFit: "safe" },
  { plant: redbud, qty: 2, slot: "support", zoneFit: "safe" },
];

describe("bundle helpers", () => {
  it("coversLines is a sub-multiset check", () => {
    expect(coversLines(FIXTURE_BUNDLES[0], lines)).toBe(true);
    expect(coversLines(FIXTURE_BUNDLES[0], [{ ...lines[0], qty: 3 }, lines[1]])).toBe(false);
    expect(coversLines(FIXTURE_BUNDLES[2], lines)).toBe(false); // consult-built, no components
  });

  it("applyBundle subtracts the components and drops emptied lines", () => {
    const out = applyBundle(lines, {
      id: 132, name: "Hazel Hedge", price: 40, saves: 22, covers: 5, consultBuilt: false,
      componentIds: [104, 104, 104, 104, 108], variantId: null,
    });
    expect(out.map((l) => [l.plant.id, l.qty])).toEqual([[104, 4], [108, 1]]);
    const all = applyBundle(lines, {
      id: 1, name: "x", price: 0, saves: 0, covers: 10, consultBuilt: false,
      componentIds: [...Array(8).fill(104), 108, 108], variantId: null,
    });
    expect(all).toEqual([]);
  });
});
