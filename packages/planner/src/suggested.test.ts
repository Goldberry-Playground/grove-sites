import { describe, expect, it } from "vitest";
import { FIXTURE_CATALOG } from "./fixtures";
import { explain, nextFor, plan } from "./plan";
import { manualLine, orderLines, stratumOf, suggested, survivingManual } from "./suggested";
import type { PlanInput, PlanLine, PlannerPlant } from "./types";

const WV: PlanInput = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" };

describe("suggested() (winter-beta spec §C.2)", () => {
  it("lists the eligible, unplaced plants grouped by stratum and sorted by score", () => {
    const result = plan(WV, FIXTURE_CATALOG);
    const s = suggested(WV, FIXTURE_CATALOG, result);
    const placed = new Set(result.lines.map((l) => l.plant.id));
    for (const pick of s.all) {
      expect(placed.has(pick.plant.id)).toBe(false);
      expect(pick.plant.in_stock && !pick.plant.preorder_cap_reached).toBe(true);
    }
    // Overstory: mulberry and hickory (chestnut is placed, oak sold out, walnut pickup-only).
    expect(s.groups.overstory.map((p) => p.plant.id)).toEqual([107, 109]);
    // Mushroom: the shiitake, since the wine cap took the slot.
    expect(s.groups.mushroom.map((p) => p.plant.id)).toEqual([118]);
    // Score order within a stratum, ties on id.
    for (const group of Object.values(s.groups)) {
      for (let i = 1; i < group.length; i++) {
        expect(group[i - 1].score >= group[i].score).toBe(true);
      }
    }
    // Open ground in zone 6 hides nothing shippable except by zone: jujube (6-9) fits; nothing hidden.
    expect(s.hidden).toBe(0);
  });

  it("respects the filter: a shade site hides the sun plants and counts them", () => {
    const shade: PlanInput = { ...WV, site: "shade" };
    const result = plan(shade, FIXTURE_CATALOG);
    const s = suggested(shade, FIXTURE_CATALOG, result);
    for (const pick of s.all) expect(pick.plant.tolerates.shade).toBe(true);
    const open = suggested(WV, FIXTURE_CATALOG, plan(WV, FIXTURE_CATALOG));
    expect(s.hidden).toBeGreaterThan(open.hidden);
    // Chestnut does not take shade and is never offered.
    expect(s.all.some((p) => p.plant.id === 101)).toBe(false);
  });

  it("never offers spawn on the deer track and skips ids the card already shows", () => {
    const deer: PlanInput = { ...WV, track: "deer", size: 8, timing: "all" };
    const s = suggested(deer, FIXTURE_CATALOG, plan(deer, FIXTURE_CATALOG));
    expect(s.groups.mushroom).toEqual([]);
    const food = suggested(WV, FIXTURE_CATALOG, plan(WV, FIXTURE_CATALOG), [107]);
    expect(food.all.some((p) => p.plant.id === 107)).toBe(false);
  });

  it("a hand add is sized to the pollination floor and marked manual; it survives Edit while it passes the filter", () => {
    const result = plan(WV, FIXTURE_CATALOG);
    const hickory = suggested(WV, FIXTURE_CATALOG, result).all.find((p) => p.plant.id === 109)!;
    const line = manualLine(hickory);
    expect(line).toMatchObject({ qty: 2, manual: true, slot: "canopy" });
    const aronia = suggested(WV, FIXTURE_CATALOG, result).all.find((p) => p.plant.id === 106)!;
    expect(manualLine(aronia).qty).toBe(1);

    // Same answers again: both picks stand.
    expect(survivingManual(WV, FIXTURE_CATALOG, result, [109, 106]).map((l) => l.plant.id)).toEqual([109, 106]);
    // Shade: hickory wants sun, aronia too; neither survives.
    const shade: PlanInput = { ...WV, site: "shade" };
    expect(survivingManual(shade, FIXTURE_CATALOG, plan(shade, FIXTURE_CATALOG), [109, 106])).toEqual([]);
    // A pick the new result placed itself is no longer manual.
    const patient: PlanInput = { ...WV, timing: "patient" };
    const pr = plan(patient, FIXTURE_CATALOG);
    const placedIds = pr.lines.map((l) => l.plant.id);
    const survivors = survivingManual(patient, FIXTURE_CATALOG, pr, placedIds);
    expect(survivors).toEqual([]);
  });
});

describe("nextFor() (Swap, §C.1)", () => {
  it("returns the next best candidate for the slot, skipping excluded ids, sized for the slot", () => {
    const result = plan(WV, FIXTURE_CATALOG);
    const onCard = result.lines.map((l) => l.plant.id);
    const next = nextFor(WV, FIXTURE_CATALOG, "canopy", onCard);
    expect(next?.plant.id).toBe(107); // mulberry outranks the hickory
    expect(next?.qty).toBe(4);
    expect(next?.manual).toBeUndefined();
    const after = nextFor(WV, FIXTURE_CATALOG, "canopy", [...onCard, 107]);
    expect(after?.plant.id).toBe(109);
    expect(after?.qty).toBe(4); // hickory floor 2 < slot 4
    expect(nextFor(WV, FIXTURE_CATALOG, "canopy", [...onCard, 107, 109])).toBeNull();
  });

  it("never swaps spawn into a tree slot or a tree into the mushroom slot", () => {
    const next = nextFor(WV, FIXTURE_CATALOG, "mushroom", [117]);
    expect(next?.plant.id).toBe(118);
    expect(nextFor(WV, FIXTURE_CATALOG, "mushroom", [117, 118])).toBeNull();
    const shrub = nextFor(WV, FIXTURE_CATALOG, "shrub", [104, 105, 106]);
    expect(shrub?.plant.layer ?? "shrub").toBe("shrub");
  });
});

describe("orderLines() and stratumOf()", () => {
  const mk = (id: number, layer: string, role: PlannerPlant["role"], stratum?: PlannerPlant["stratum"]): PlanLine => ({
    plant: { ...FIXTURE_CATALOG.plants[0], id, layer, role, stratum: stratum ?? null },
    qty: 1,
    slot: "canopy",
    zoneFit: "safe",
  });

  it("orders by stratum (overstory, understory, mushroom) then anchor first, keeping engine order otherwise", () => {
    const lines = [
      mk(5, "fungal", "companion"),
      mk(4, "shrub", "companion"),
      mk(3, "understory", "anchor"),
      mk(2, "canopy", "companion"),
      mk(1, "canopy", "anchor"),
      mk(6, "fungal", "anchor"),
      mk(7, "shrub", null),
    ];
    expect(orderLines(lines).map((l) => l.plant.id)).toEqual([1, 2, 3, 4, 7, 6, 5]);
  });

  it("derives the stratum from the layer when the feed has none (§A.1)", () => {
    expect(stratumOf({ layer: "canopy", stratum: null })).toBe("overstory");
    expect(stratumOf({ layer: "vine", stratum: null })).toBe("understory");
    expect(stratumOf({ layer: "ground", stratum: null })).toBe("understory");
    expect(stratumOf({ layer: "fungal", stratum: null })).toBe("mushroom");
    expect(stratumOf({ layer: null, stratum: null })).toBeNull();
    expect(stratumOf({ layer: "canopy", stratum: "understory" })).toBe("understory");
  });

  it("the fixture plan reads in planting order after ordering", () => {
    const ordered = orderLines(plan(WV, FIXTURE_CATALOG).lines);
    expect(ordered.map((l) => stratumOf(l.plant))).toEqual([
      "overstory", "understory", "understory", "understory", "mushroom",
    ]);
    expect(ordered[1].plant.role).toBe("anchor"); // persimmon before the companions
  });
});

describe("explain()", () => {
  it("adds up to the score and names every term", () => {
    const result = plan(WV, FIXTURE_CATALOG);
    for (const line of result.lines) {
      const e = explain(WV, FIXTURE_CATALOG, line);
      expect(e.parts.reduce((s, p) => s + p.value, 0)).toBe(e.total);
      expect(e.parts[0]).toEqual({ key: "base", label: "Start", value: 100 });
    }
    const chestnut = result.lines[0];
    const e = explain(WV, FIXTURE_CATALOG, chestnut, { years_weight: 10 });
    expect(e.parts.find((p) => p.key === "years_weight")?.value).toBe(-40);
  });
});
