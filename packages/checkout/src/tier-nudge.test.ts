import { describe, expect, it } from "vitest";
import { tierFor, tierLabel, tierNudgeFor } from "./tier-nudge";

// The QA/prod program shape (GOL-2431): 5+ trees → 10%, 10+ → 20%. Arrives
// unsorted on purpose — the nudge must not depend on feed order.
const TIERS = [
  { minQty: 10, percent: 20, label: "20% off 10+ trees" },
  { minQty: 5, percent: 10, label: "10% off 5+ trees" },
];

describe("tierNudgeFor — volume nudge thresholds (GOL-2432)", () => {
  it.each([
    [1, "locked", "Add 4 more trees to unlock 10% off"],
    [4, "locked", "Add 1 more tree to unlock 10% off"],
    [5, "partial", "10% off unlocked — add 5 more for 20%"],
    [9, "partial", "10% off unlocked — add 1 more for 20%"],
    [10, "max", "20% off unlocked"],
    [12, "max", "20% off unlocked"],
  ])("%i qualifying trees → %s: %s", (units, state, message) => {
    expect(tierNudgeFor(TIERS, units)).toMatchObject({ state, message });
  });

  it("shows nothing for a cart with no qualifying trees (supplies / gift cards only)", () => {
    expect(tierNudgeFor(TIERS, 0)).toBeNull();
  });

  it("shows nothing when the tree count is unknown or no program is live", () => {
    expect(tierNudgeFor(TIERS, null)).toBeNull();
    expect(tierNudgeFor([], 7)).toBeNull();
  });

  it("labels the summary row and picks the highest reached tier", () => {
    expect(tierLabel({ minQty: 5, percent: 10 })).toBe("Volume discount (10% for 5+ trees)");
    expect(tierFor(TIERS, 4)).toBeNull();
    expect(tierFor(TIERS, 9)?.percent).toBe(10);
    expect(tierFor(TIERS, 10)?.percent).toBe(20);
  });
});
