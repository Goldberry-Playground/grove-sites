import type { PlannerCatalog, PlannerRules, RuleKey } from "./types";

/**
 * The retail rule values the score reads (winter-beta spec §B.1). These are
 * the shipped order-builder constants; Odoo seeds `grove.planner.rule` from
 * the same eight numbers, so the first feed that carries `rules` changes
 * nothing. A feed that omits a key (or predates B) falls back to these.
 */
export const RULE_KEYS: readonly RuleKey[] = [
  "priority_weight",
  "years_weight",
  "marginal_penalty",
  "season_bonus",
  "wildlife_bonus",
  "nitrogen_bonus",
  "timing_fast",
  "timing_patient",
];

export const DEFAULT_RULES: Readonly<PlannerRules> = Object.freeze({
  priority_weight: 2,
  years_weight: 1.5,
  marginal_penalty: 40,
  season_bonus: 4,
  wildlife_bonus: 10,
  nitrogen_bonus: 10,
  timing_fast: 3,
  timing_patient: 2,
});

/** Labels and hints for the tester bench sliders (spec §C.4). */
export const RULE_LABELS: Readonly<Record<RuleKey, { label: string; hint: string }>> = {
  priority_weight: { label: "Priority weight", hint: "Points off per priority point; lower priority sorts first" },
  years_weight: { label: "Years weight", hint: "Points off per year to the first crop" },
  marginal_penalty: { label: "Marginal zone penalty", hint: "Points off when the plant is one zone outside its range" },
  season_bonus: { label: "Season bonus", hint: "Deer track: points per drop month in the slot's season" },
  wildlife_bonus: { label: "Wildlife bonus", hint: "Deer track: points for a high wildlife value" },
  nitrogen_bonus: { label: "Nitrogen bonus", hint: "Support slot: points for a nitrogen fixer" },
  timing_fast: { label: "Fast timing", hint: "Extra points off per year when they want a crop soon" },
  timing_patient: { label: "Patient timing", hint: "Points on per year when they are planting for the long run" },
};

/**
 * The rules a plan runs on: the feed's values where present and finite, the
 * shipped constants for the rest. Pure; never mutates the catalog.
 */
export function resolveRules(catalog: Pick<PlannerCatalog, "rules"> | undefined, overrides?: Partial<PlannerRules>): PlannerRules {
  const out: PlannerRules = { ...DEFAULT_RULES };
  for (const key of RULE_KEYS) {
    const fromFeed = catalog?.rules?.[key];
    if (typeof fromFeed === "number" && Number.isFinite(fromFeed)) out[key] = fromFeed;
    const fromOverride = overrides?.[key];
    if (typeof fromOverride === "number" && Number.isFinite(fromOverride)) out[key] = fromOverride;
  }
  return out;
}
