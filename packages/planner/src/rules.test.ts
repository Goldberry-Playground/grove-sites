import { describe, expect, it } from "vitest";
import { FIXTURE_CATALOG, FIXTURE_RULES } from "./fixtures";
import { plan, score } from "./plan";
import { DEFAULT_RULES, RULE_KEYS, resolveRules } from "./rules";
import type { PlanInput, PlannerCatalog } from "./types";

const WV: PlanInput = { zone: 6, state: "WV", site: "open", track: "food", size: 20, timing: "mixed" };

describe("rules (winter-beta spec §B.1 / §C.5)", () => {
  it("the fallback equals the seed: a feed with no rules scores like the shipped constants", () => {
    expect(resolveRules(undefined)).toEqual(DEFAULT_RULES);
    expect(resolveRules({ rules: undefined })).toEqual(DEFAULT_RULES);
    expect(resolveRules({ rules: {} })).toEqual(DEFAULT_RULES);
    // The fixture feed carries the seed, so it must change nothing either.
    expect(FIXTURE_RULES).toEqual(DEFAULT_RULES);
    expect(DEFAULT_RULES).toEqual({
      priority_weight: 2, years_weight: 1.5, marginal_penalty: 40, season_bonus: 4,
      wildlife_bonus: 10, nitrogen_bonus: 10, timing_fast: 3, timing_patient: 2,
    });
    const withRules = plan(WV, FIXTURE_CATALOG);
    const withoutRules = plan(WV, { ...FIXTURE_CATALOG, rules: undefined });
    expect(withRules).toEqual(withoutRules);
  });

  it("a feed value overrides the constant per key; missing and non-finite keys keep the fallback", () => {
    const r = resolveRules({ rules: { marginal_penalty: 5, years_weight: Number.NaN } });
    expect(r.marginal_penalty).toBe(5);
    expect(r.years_weight).toBe(DEFAULT_RULES.years_weight);
    for (const key of RULE_KEYS) expect(typeof r[key]).toBe("number");
    // Bench overrides win over the feed and never touch the catalog.
    const catalog = { rules: { marginal_penalty: 5 } };
    expect(resolveRules(catalog, { marginal_penalty: 1 }).marginal_penalty).toBe(1);
    expect(catalog.rules.marginal_penalty).toBe(5);
  });

  it("the rules object changes the plan: a heavy years weight moves fast croppers up", () => {
    const chestnut = FIXTURE_CATALOG.plants.find((p) => p.id === 101)!;
    const mulberry = FIXTURE_CATALOG.plants.find((p) => p.id === 107)!;
    const base = resolveRules(undefined);
    expect(score(chestnut, "safe", "canopy", 4, WV, base)).toBeGreaterThan(score(mulberry, "safe", "canopy", 4, WV, base));
    const heavy = resolveRules({ rules: { years_weight: 60 } });
    expect(score(mulberry, "safe", "canopy", 4, WV, heavy)).toBeGreaterThan(score(chestnut, "safe", "canopy", 4, WV, heavy));

    const catalog: PlannerCatalog = { ...FIXTURE_CATALOG, rules: { years_weight: 60 } };
    expect(plan(WV, catalog).lines.find((l) => l.slot === "canopy")?.plant.id).toBe(107);
    expect(plan(WV, FIXTURE_CATALOG).lines.find((l) => l.slot === "canopy")?.plant.id).toBe(101);
  });

  it("determinism holds with rules supplied", () => {
    const catalog: PlannerCatalog = { ...FIXTURE_CATALOG, rules: { priority_weight: 1, timing_patient: 7 } };
    const a = plan({ ...WV, timing: "patient" }, catalog);
    const b = plan({ ...WV, timing: "patient" }, structuredClone(catalog));
    expect(a).toEqual(b);
    expect(JSON.stringify(catalog.rules)).toBe('{"priority_weight":1,"timing_patient":7}');
  });

  it("the nitrogen bonus only speaks in the support slot", () => {
    const redbud = FIXTURE_CATALOG.plants.find((p) => p.id === 108)!;
    const buttonbush = FIXTURE_CATALOG.plants.find((p) => p.id === 113)!;
    const rules = resolveRules(undefined);
    // Redbud (priority 30, fixes nitrogen) vs buttonbush (priority 50): 10 points on top of the priority gap.
    expect(score(redbud, "safe", "support", 2, WV, rules) - score(buttonbush, "safe", "support", 2, WV, rules)).toBe(
      2 * 20 + rules.nitrogen_bonus,
    );
    // Zeroing it leaves the priority gap alone.
    const zero = resolveRules({ rules: { nitrogen_bonus: 0 } });
    expect(score(redbud, "safe", "support", 2, WV, zero) - score(buttonbush, "safe", "support", 2, WV, zero)).toBe(2 * 20);
  });
});
