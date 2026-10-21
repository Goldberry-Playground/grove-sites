import { describe, expect, it } from "vitest";
import { FIXTURE_CATALOG, FIXTURE_PLANTS } from "./fixtures";
import { plan, score } from "./plan";
import type { PlanInput, PlanResult, PlannerCatalog, PlannerPlant } from "./types";

const WV: PlanInput = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" };

function lineIds(r: PlanResult): [number, number, string][] {
  return r.lines.map((l) => [l.plant.id, l.qty, l.slot]);
}

function withPlants(plants: PlannerPlant[], bundles = FIXTURE_CATALOG.bundles): PlannerCatalog {
  return { ...FIXTURE_CATALOG, plants, bundles };
}

describe("plan(): golden results per track (fixture catalog, zone 6 WV)", () => {
  it("food forest 20, mixed: one line per layer slot, status ok", () => {
    const r = plan(WV, FIXTURE_CATALOG);
    expect(r.status).toBe("ok");
    // canopy 4 → chestnut (priority 10); understory 6 → persimmon (20);
    // shrub 8 → hazelnut (20); support 2 → redbud (ties with buttonbush, lower id);
    // mushroom (share 0) → one wine cap spawn (winter beta), not a tree.
    expect(lineIds(r)).toEqual([
      [101, 4, "canopy"],
      [102, 6, "understory"],
      [104, 8, "shrub"],
      [108, 2, "support"],
      [117, 1, "mushroom"],
    ]);
    expect(r.treeCount).toBe(20);
    expect(r.subtotal).toBe(4 * 28 + 6 * 18 + 8 * 12 + 2 * 14 + 24);
    expect(r.consult).toBe(false);
    expect(r.harvestMonths).toEqual([5, 6, 8, 9, 10, 11]);
    // Sold-out sawtooth oak and cap-reached crabapple would have qualified.
    expect(r.notify.map((p) => p.id)).toEqual([110, 114]);
    // Pickup-only black walnut is never in the pool nor in notify.
    expect(r.notify.some((p) => p.id === 115)).toBe(false);
  });

  it("food forest 5 (Corner) gives 3 to 4 tree lines, not 5", () => {
    const r = plan({ ...WV, size: 5 }, FIXTURE_CATALOG);
    const treeLines = r.lines.filter((l) => l.slot !== "mushroom");
    expect(treeLines.length).toBeGreaterThanOrEqual(3);
    expect(treeLines.length).toBeLessThanOrEqual(4);
    // canopy 1 → chestnut raised to its pollination floor of 2.
    const canopy = r.lines.find((l) => l.slot === "canopy")!;
    expect(canopy.qty).toBe(2);
    expect(canopy.note).toBe("needs 2 to pollinate");
  });

  it("fast timing prefers quick croppers; patient prefers long-lived nuts", () => {
    const fast = plan({ ...WV, timing: "fast" }, FIXTURE_CATALOG);
    const patient = plan({ ...WV, timing: "patient" }, FIXTURE_CATALOG);
    // Canopy: chestnut (4 yrs, priority 10) vs mulberry (3 yrs, 35) vs hickory (10 yrs, 30).
    expect(fast.lines.find((l) => l.slot === "canopy")!.plant.id).toBe(101);
    expect(patient.lines.find((l) => l.slot === "canopy")!.plant.id).toBe(101);
    // Understory on fast: persimmon (4 yrs, 20) still beats plum (3 yrs, 40).
    const persimmonFast = score(FIXTURE_PLANTS[1], "safe", "understory", 6, { track: "food", timing: "fast" });
    const persimmonPatient = score(FIXTURE_PLANTS[1], "safe", "understory", 6, { track: "food", timing: "patient" });
    expect(persimmonPatient - persimmonFast).toBe(5 * 4);
  });

  it("agroforestry: each sub-goal uses its slot table and always asks for the consult", () => {
    const alley = plan({ ...WV, track: "agro", subgoal: "alley", size: 50 }, FIXTURE_CATALOG);
    expect(alley.lines.map((l) => l.slot)).toEqual(["canopy", "shrub", "mushroom"]);
    expect(alley.lines.map((l) => l.qty)).toEqual([25, 25, 1]);
    expect(alley.treeCount).toBe(50);
    expect(alley.consult).toBe(true);

    const silvo = plan({ ...WV, track: "agro", subgoal: "silvo", size: 50 }, FIXTURE_CATALOG);
    expect(silvo.lines.map((l) => [l.slot, l.qty])).toEqual([["canopy", 35], ["understory", 15], ["mushroom", 1]]);

    const windbreak = plan({ ...WV, track: "agro", subgoal: "windbreak", size: 100 }, FIXTURE_CATALOG);
    expect(windbreak.lines.map((l) => [l.slot, l.qty])).toEqual([
      ["canopy", 40], ["understory", 30], ["shrub", 30], ["mushroom", 1],
    ]);

    // Riparian buffer: wet-tolerant plants only (persimmon, pawpaw / elderberry, aronia, buttonbush).
    const riparian = plan({ ...WV, track: "agro", subgoal: "riparian", size: 50 }, FIXTURE_CATALOG);
    expect(riparian.lines.every((l) => l.plant.tolerates.wet)).toBe(true);
    expect(riparian.lines.map((l) => [l.plant.id, l.slot, l.qty])).toEqual([
      [102, "understory", 20], [105, "shrub", 30], [117, "mushroom", 1],
    ]);
  });

  it("deer track: wildlife high/medium only, seasons from harvest months", () => {
    const all = plan({ ...WV, track: "deer", size: 16, timing: "all" }, FIXTURE_CATALOG);
    expect(all.lines.map((l) => l.slot)).toEqual(["early", "late"]);
    expect(all.lines.every((l) => l.plant.wildlife_value !== "low")).toBe(true);
    // Early: chestnut (Sep, Oct; priority 10; high) beats everything. Late: persimmon (Nov) is
    // the only in-stock late dropper; it also drops Sep/Oct so it is "both".
    expect(all.lines.map((l) => [l.plant.id, l.qty])).toEqual([[101, 8], [102, 8]]);

    const early = plan({ ...WV, track: "deer", size: 16, timing: "early" }, FIXTURE_CATALOG);
    expect(early.lines.map((l) => [l.slot, l.qty])).toEqual([["early", 12], ["late", 4]]);

    const late = plan({ ...WV, track: "deer", size: 16, timing: "late" }, FIXTURE_CATALOG);
    expect(late.lines.map((l) => [l.slot, l.qty])).toEqual([["early", 4], ["late", 12]]);

    // All year adds an offseason slot: red mulberry (Jun, Jul) is the only candidate.
    const year = plan({ ...WV, track: "deer", size: 30, timing: "year" }, FIXTURE_CATALOG);
    expect(year.lines.map((l) => [l.plant.id, l.slot, l.qty])).toEqual([
      [101, "early", 12], [102, "late", 12], [107, "offseason", 6],
    ]);
  });

  it("deer: a plant dropping in both seasons scores 10 lower in the early slot", () => {
    const persimmon = FIXTURE_PLANTS[1];
    const early = score(persimmon, "safe", "early", 8, { track: "deer", timing: "all" });
    const late = score(persimmon, "safe", "late", 8, { track: "deer", timing: "all" });
    // early: 2 in-season months (+8) and the both-penalty (-10); late: 1 month (+4).
    expect(early - late).toBe(8 - 10 - 4);
  });
});

describe("plan(): zone edge cases", () => {
  it("safe inside the range, marginal one zone out, excluded further", () => {
    const pawpawOnly = withPlants([FIXTURE_PLANTS[2]]);
    const base: PlanInput = { ...WV, track: "food", site: "open" };
    expect(plan({ ...base, zone: 7 }, pawpawOnly).lines[0]?.zoneFit).toBe("safe");
    const marginal = plan({ ...base, zone: 9 }, pawpawOnly);
    expect(marginal.lines[0]?.zoneFit).toBe("marginal");
    expect(plan({ ...base, zone: 10 }, pawpawOnly).status).toBe("empty");
    expect(plan({ ...base, zone: 3 }, pawpawOnly).status).toBe("empty");
  });

  it("a marginal plant loses 40 points to a safe one", () => {
    const hazel = FIXTURE_PLANTS[3];
    const safe = score(hazel, "safe", "shrub", 8, WV);
    const marginal = score(hazel, "marginal", "shrub", 8, WV);
    expect(safe - marginal).toBe(40);
  });

  it("a state band: safe when the plant covers it, marginal when it overlaps", () => {
    const pawpawOnly = withPlants([FIXTURE_PLANTS[2]]); // zones 5 to 8
    expect(plan({ ...WV, zone: { band: [5, 7] } }, pawpawOnly).lines[0].zoneFit).toBe("safe");
    expect(plan({ ...WV, zone: { band: [7, 9] } }, pawpawOnly).lines[0].zoneFit).toBe("marginal");
    expect(plan({ ...WV, zone: { band: [9, 11] } }, pawpawOnly).status).toBe("empty");
  });
});

describe("plan(): site filter", () => {
  it("wet needs tolerates.wet, poor needs poor_soil, shade needs shade, open needs nothing", () => {
    const wet = plan({ ...WV, site: "wet" }, FIXTURE_CATALOG);
    expect(wet.lines.every((l) => l.plant.tolerates.wet)).toBe(true);
    const poor = plan({ ...WV, site: "poor" }, FIXTURE_CATALOG);
    expect(poor.lines.every((l) => l.plant.tolerates.poor_soil)).toBe(true);
    const shade = plan({ ...WV, site: "shade" }, FIXTURE_CATALOG);
    expect(shade.lines.every((l) => l.plant.tolerates.shade)).toBe(true);
  });

  it("empty: nothing fits a wet spot in zone 1", () => {
    const r = plan({ ...WV, zone: 1, site: "wet" }, FIXTURE_CATALOG);
    expect(r.status).toBe("empty");
    expect(r.lines).toEqual([]);
    expect(r.subtotal).toBe(0);
  });
});

describe("plan(): compliance carve-outs", () => {
  it("Florida: chestnut is blocked and shagbark hickory ships in its place", () => {
    const r = plan({ ...WV, zone: 8, state: "FL" }, withPlants([FIXTURE_PLANTS[0], FIXTURE_PLANTS[8]]));
    expect(r.lines.some((l) => l.plant.id === 101)).toBe(false);
    expect(r.substitutions).toEqual([
      expect.objectContaining({ state: "FL", from: expect.objectContaining({ id: 101 }), to: expect.objectContaining({ id: 109 }) }),
    ]);
    expect(r.lines.find((l) => l.slot === "canopy")!.plant.id).toBe(109);
    // In the full catalog the substitute only shows when it made the plan: at zone 8
    // red mulberry out-scores hickory for the canopy, so no substitution is reported.
    const full = plan({ ...WV, zone: 8, state: "FL" }, FIXTURE_CATALOG);
    expect(full.lines.some((l) => l.plant.id === 101)).toBe(false);
    expect(full.substitutions).toEqual([]);
  });

  it("Florida: dogwood has no substitute and is dropped; the substitution list stays clean", () => {
    const dogwoodOnly = withPlants([FIXTURE_PLANTS[15], FIXTURE_PLANTS[12]]);
    const fl = plan({ ...WV, zone: 8, state: "FL", site: "shade" }, dogwoodOnly);
    expect(fl.lines.map((l) => l.plant.id)).toEqual([113]);
    expect(fl.substitutions).toEqual([]);
    // Next door in Georgia the dogwood (priority 40) beats buttonbush (50) for the support slot.
    const ga = plan({ ...WV, zone: 8, state: "GA", site: "shade" }, dogwoodOnly);
    expect(ga.lines.map((l) => l.plant.id)).toEqual([116]);
  });

  it("a substitute that is itself blocked (hickory in NM) drops the plant", () => {
    const chestnutBlockedInNm = { ...FIXTURE_PLANTS[0], blocked_states: ["NM"] };
    const r = plan({ ...WV, state: "NM" }, withPlants([chestnutBlockedInNm, FIXTURE_PLANTS[8]]));
    expect(r.status).toBe("empty");
    expect(r.substitutions).toEqual([]);
  });

  it("a substitute missing from the feed drops the plant", () => {
    const r = plan({ ...WV, state: "FL", zone: 8 }, withPlants([FIXTURE_PLANTS[0]]));
    expect(r.status).toBe("empty");
    expect(r.substitutions).toEqual([]);
  });

  it("Oregon: American plum is swapped for jujube and the note reads inline on that line", () => {
    const r = plan({ ...WV, zone: 7, state: "OR" }, withPlants([FIXTURE_PLANTS[10], FIXTURE_PLANTS[11]]));
    expect(r.lines.map((l) => l.plant.id)).toEqual([112]);
    expect(r.substitutions[0]).toMatchObject({ state: "OR", from: { id: 111 }, to: { id: 112 } });
  });
});

describe("plan(): pollination floor and cap", () => {
  it("raises a line to pollination_min and says so", () => {
    const chestnutOnly = withPlants([FIXTURE_PLANTS[0]]);
    const r = plan({ ...WV, size: 5 }, chestnutOnly);
    expect(r.lines[0]).toMatchObject({ qty: 2, note: "needs 2 to pollinate" });
    const big = plan({ ...WV, size: 100 }, chestnutOnly);
    expect(big.lines[0].qty).toBe(20);
    expect(big.lines[0].note).toBeUndefined();
  });

  it("penalises a plant whose pollination floor would force a big line", () => {
    const chestnut = FIXTURE_PLANTS[0];
    // pollination_min 2 never exceeds slotQty + 2, so no penalty at any size.
    expect(score(chestnut, "safe", "canopy", 1, WV)).toBe(score(chestnut, "safe", "canopy", 4, WV));
    const needsFive = { ...chestnut, pollination_min: 5 };
    expect(score(needsFive, "safe", "canopy", 4, WV) - score(needsFive, "safe", "canopy", 2, WV)).toBe(20);
  });

  it("cap-reached and out-of-stock plants go to notify, never to a line", () => {
    const r = plan(WV, FIXTURE_CATALOG);
    expect(r.lines.some((l) => l.plant.id === 110 || l.plant.id === 114)).toBe(false);
    expect(r.notify.map((p) => p.id)).toContain(110);
    expect(r.notify.map((p) => p.id)).toContain(114);
  });
});

describe("plan(): status and consult", () => {
  it("partial when a slot cannot be filled, and that asks for the consult", () => {
    const noSupport = withPlants(FIXTURE_PLANTS.filter((p) => p.harvest_months.length > 0));
    const r = plan(WV, noSupport);
    expect(r.status).toBe("partial");
    expect(r.unfilled).toEqual(["support"]);
    expect(r.consult).toBe(true);
  });

  it("consult at a $500 subtotal", () => {
    const r = plan({ ...WV, size: 100 }, FIXTURE_CATALOG);
    expect(r.subtotal).toBeGreaterThanOrEqual(500);
    expect(r.consult).toBe(true);
  });
});

describe("plan(): bundle match", () => {
  it("offers a bundle whose components are a sub-multiset of the lines, with the saving", () => {
    const r = plan(WV, FIXTURE_CATALOG);
    // Hazel Hedge = 4 hazelnut + 1 redbud ($62 of lines) for $40.
    expect(r.bundle).toEqual({
      id: 132, name: "Hazel Hedge", price: 40, saves: 22, covers: 5, consultBuilt: false,
      componentIds: [104, 104, 104, 104, 108], variantId: 1321,
    });
  });

  it("does not offer a bundle the lines cannot cover", () => {
    const r = plan({ ...WV, size: 5 }, FIXTURE_CATALOG); // shrub line is only 2 hazelnuts
    expect(r.bundle).toBeUndefined();
  });

  it("offers the consult-built package instead at 50 trees and on the agro track", () => {
    const fifty = plan({ ...WV, size: 50 }, FIXTURE_CATALOG);
    expect(fifty.bundle).toMatchObject({ id: 134, consultBuilt: true, covers: 50, saves: 0 });
    const hundred = plan({ ...WV, size: 100 }, FIXTURE_CATALOG);
    expect(hundred.bundle).toMatchObject({ id: 135, covers: 100 });
    const agro = plan({ ...WV, track: "agro", subgoal: "alley", size: 50 }, FIXTURE_CATALOG);
    expect(agro.bundle).toMatchObject({ id: 134, consultBuilt: true });
    // The planned mix still rides along as the starting point (plus the spawn line).
    expect(agro.lines.length).toBe(3);
  });
});

describe("plan(): determinism", () => {
  it("two runs on the same input and catalog are equal", () => {
    const a = plan(WV, FIXTURE_CATALOG);
    const b = plan(WV, FIXTURE_CATALOG);
    expect(a).toEqual(b);
  });

  it("ties break on id regardless of catalog order", () => {
    const shuffled = withPlants([...FIXTURE_PLANTS].reverse());
    expect(plan(WV, shuffled)).toEqual(plan(WV, FIXTURE_CATALOG));
  });
});
