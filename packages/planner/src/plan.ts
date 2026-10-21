import { matchBundle } from "./bundle";
import { resolveRules } from "./rules";
import { fitsSlot, deerSeason, isFungal, seasonMonths, slotsFor } from "./slots";
import type {
  PlanInput,
  PlanLine,
  PlanResult,
  PlannerCatalog,
  PlannerPlant,
  PlannerRules,
  ScoreExplanation,
  ScorePart,
  Slot,
  Substitution,
  ZoneFit,
} from "./types";
import { zoneFit } from "./zone";

/**
 * Tiers the planner may put in a shipped order. Potted ships on its own box
 * engine since GOL-2199 and is the default tier, so excluding it would drop
 * most of the catalog. Seeds are not plants and are never in the feed.
 */
export const SHIPPABLE_TIERS: ReadonlySet<string> = new Set(["bareroot", "potted"]);

/** Cart subtotal at or above which the result offers the consult (§D). */
export const CONSULT_SUBTOTAL = 500;

/** Priority the score assumes when the feed carries none (§A default is 50). */
const DEFAULT_PRIORITY = 50;

export interface Candidate {
  plant: PlannerPlant;
  zoneFit: ZoneFit;
}

/** Everything the filter decided about a catalog for one set of answers. */
export interface Eligibility {
  /** Available plants that pass every filter, keyed by template id. */
  pool: Map<number, Candidate>;
  /** Passed every filter but out of stock or cap-reached. */
  notify: Map<number, PlannerPlant>;
  substitutions: Substitution[];
  /** Shippable plants the zone or site filter hid (the "hidden for this site" count). */
  hidden: number;
}

function shippable(plant: PlannerPlant): boolean {
  return !plant.pickup_only && plant.tier != null && SHIPPABLE_TIERS.has(plant.tier);
}

function siteOk(plant: PlannerPlant, site: PlanInput["site"]): boolean {
  switch (site) {
    case "wet":
      return plant.tolerates.wet;
    case "poor":
      return plant.tolerates.poor_soil;
    case "shade":
      return plant.tolerates.shade;
    default:
      return true;
  }
}

function available(plant: PlannerPlant): boolean {
  return plant.in_stock && !plant.preorder_cap_reached;
}

/** The score as a list of terms (§C.2), so the tester bench can show it. */
export function explainScore(
  plant: PlannerPlant,
  fit: ZoneFit,
  slot: Slot,
  slotQty: number,
  input: Pick<PlanInput, "track" | "timing">,
  rules: PlannerRules,
): ScoreExplanation {
  const priority = plant.priority ?? DEFAULT_PRIORITY;
  const years = plant.years_to_fruit_min ?? 0;
  const parts: ScorePart[] = [{ key: "base", label: "Start", value: 100 }];
  parts.push({ key: "priority_weight", label: `Priority ${priority}`, value: -rules.priority_weight * priority });
  if (years) parts.push({ key: "years_weight", label: `${years} years to fruit`, value: -rules.years_weight * years });
  if (fit === "marginal") parts.push({ key: "marginal_penalty", label: "Marginal zone", value: -rules.marginal_penalty });
  if (input.track !== "deer") {
    if (input.timing === "fast" && years) {
      parts.push({ key: "timing_fast", label: "You want it fast", value: -rules.timing_fast * years });
    } else if (input.timing === "patient" && years) {
      parts.push({ key: "timing_patient", label: "You are patient", value: rules.timing_patient * years });
    }
    if (slot === "support" && plant.nitrogen_fixer) {
      parts.push({ key: "nitrogen_bonus", label: "Fixes nitrogen", value: rules.nitrogen_bonus });
    }
  } else {
    const inSeason = seasonMonths(slot);
    const months = plant.harvest_months.filter((m) => inSeason.includes(m)).length;
    if (months) parts.push({ key: "season_bonus", label: `${months} drop months in season`, value: rules.season_bonus * months });
    if (plant.wildlife_value === "high") parts.push({ key: "wildlife_bonus", label: "High wildlife value", value: rules.wildlife_bonus });
    // A plant that drops in both seasons fills either slot, scored 10 lower in
    // early so a true early tree wins there (Whitetail's rule, kept).
    if (slot === "early" && deerSeason(plant) === "both") {
      parts.push({ key: "season_bonus", label: "Drops in both seasons", value: -10 });
    }
  }
  if ((plant.pollination_min ?? 1) > slotQty + 2) {
    parts.push({ key: "pollination", label: `Needs ${plant.pollination_min} to pollinate`, value: -20 });
  }
  const total = parts.reduce((s, p) => s + p.value, 0);
  return { total, parts };
}

/** Score per candidate within a slot (§C.2); higher wins. */
export function score(
  plant: PlannerPlant,
  fit: ZoneFit,
  slot: Slot,
  slotQty: number,
  input: Pick<PlanInput, "track" | "timing">,
  rules: PlannerRules = resolveRules(undefined),
): number {
  return explainScore(plant, fit, slot, slotQty, input, rules).total;
}

/**
 * The §C.2 filter, once, for one set of answers: shippable, carve-out
 * substitution for the state, zone fit, site, the deer and riparian gates.
 * `plan`, `nextFor` and `suggested` all read the same pool, so a hand add is
 * eligible exactly when the engine could have picked it.
 */
export function eligible(input: PlanInput, catalog: PlannerCatalog): Eligibility {
  const byId = new Map<number, PlannerPlant>();
  for (const p of catalog.plants) byId.set(p.id, p);

  const pool = new Map<number, Candidate>();
  const notify = new Map<number, PlannerPlant>();
  const substitutions: Substitution[] = [];
  const state = input.state;
  let hidden = 0;

  // Filter in id order so every later tie-break is stable.
  const plants = [...catalog.plants].sort((a, b) => a.id - b.id);
  for (const original of plants) {
    if (!shippable(original)) continue;
    let plant = original;
    if (state && original.blocked_states.includes(state)) {
      const sub = original.substitute_id != null ? byId.get(original.substitute_id) : undefined;
      if (!sub || !shippable(sub) || sub.blocked_states.includes(state)) continue;
      plant = sub;
      if (!substitutions.some((s) => s.from.id === original.id)) {
        substitutions.push({ from: original, to: sub, state });
      }
    }
    const fit = zoneFit(plant, input.zone);
    if (!fit || !siteOk(plant, input.site)) {
      hidden += 1;
      continue;
    }
    if (input.track === "deer" && plant.wildlife_value !== "high" && plant.wildlife_value !== "medium") {
      continue;
    }
    if (input.track === "agro" && input.subgoal === "riparian" && !plant.tolerates.wet) continue;
    if (available(plant)) {
      if (!pool.has(plant.id)) pool.set(plant.id, { plant, zoneFit: fit });
    } else if (!notify.has(plant.id)) {
      notify.set(plant.id, plant);
    }
  }
  return { pool, notify, substitutions, hidden };
}

function slotQtyFor(total: number, share: number): number {
  // A slot with fewer than 2 trees' share still gets 1 line if a candidate exists.
  return Math.max(1, Math.round(total * share));
}

/** Best candidate for `slot` from `pool`, skipping `exclude`; null when none fits. */
function bestFor(
  pool: Iterable<Candidate>,
  slot: Slot,
  slotQty: number,
  input: PlanInput,
  rules: PlannerRules,
  exclude: ReadonlySet<number>,
): Candidate | null {
  const ranked = [...pool]
    .filter((c) => !exclude.has(c.plant.id) && fitsSlot(c.plant, slot, input.track))
    .map((c) => ({ c, s: score(c.plant, c.zoneFit, slot, slotQty, input, rules) }))
    .sort((a, b) => b.s - a.s || a.c.plant.id - b.c.plant.id);
  return ranked[0]?.c ?? null;
}

function lineFor(c: Candidate, slot: Slot, slotQty: number): PlanLine {
  const floor = c.plant.pollination_min ?? 1;
  const qty = Math.max(slotQty, floor);
  const line: PlanLine = { plant: c.plant, qty, slot, zoneFit: c.zoneFit };
  if (qty > slotQty) line.note = `needs ${floor} to pollinate`;
  return line;
}

/**
 * `plan(input, catalog)`: the whole order builder as one pure function.
 * Same input and catalog give the same result; ties break on `id`. No Date,
 * no random, no network. Rule values come from the feed (`catalog.rules`)
 * with the shipped constants as the fallback for any missing key.
 */
export function plan(input: PlanInput, catalog: PlannerCatalog): PlanResult {
  const rules = resolveRules(catalog);
  const { pool, notify, substitutions } = eligible(input, catalog);

  const slots = slotsFor(input.track, input.subgoal, input.timing);
  const lines: PlanLine[] = [];
  const unfilled: Slot[] = [];
  const used = new Set<number>();
  const total = Math.max(0, Math.floor(input.size));

  for (const { slot, share } of slots) {
    const slotQty = slotQtyFor(total, share);
    const best = bestFor(pool.values(), slot, slotQty, input, rules, used);
    if (!best) {
      // A share-0 slot (mushroom) is optional: nothing to fill is not a gap.
      if (share > 0) unfilled.push(slot);
      continue;
    }
    used.add(best.plant.id);
    lines.push(lineFor(best, slot, slotQty));
  }

  // Only substitutions that actually ended up in the plan are worth saying.
  const lineIds = new Set(lines.map((l) => l.plant.id));
  const keptSubstitutions = substitutions.filter((s) => lineIds.has(s.to.id));

  // A plant that would have been picked goes to notify: only those that fit a
  // slot the plan has, so a sold-out vine never nags a food-forest shopper.
  const notifyList = [...notify.values()]
    .filter((p) => slots.some(({ slot }) => fitsSlot(p, slot, input.track)))
    .sort((a, b) => a.id - b.id);

  const status: PlanResult["status"] =
    lines.length === 0 ? "empty" : unfilled.length === 0 ? "ok" : "partial";
  const subtotal = round2(lines.reduce((sum, l) => sum + l.qty * l.plant.price, 0));
  const treeCount = countTrees(lines);
  const consult = subtotal >= CONSULT_SUBTOTAL || input.track === "agro" || status === "partial";
  const harvestMonths = [...new Set(lines.flatMap((l) => l.plant.harvest_months))].sort(
    (a, b) => a - b,
  );

  const result: PlanResult = {
    status,
    lines,
    substitutions: keptSubstitutions,
    notify: notifyList,
    subtotal,
    treeCount,
    consult,
    harvestMonths,
    unfilled,
  };
  const bundle = matchBundle(lines, catalog, input, subtotal);
  if (bundle) result.bundle = bundle;
  return result;
}

/** Trees in a set of lines: spawn is not a tree. */
export function countTrees(lines: readonly PlanLine[]): number {
  return lines.reduce((sum, l) => sum + (isFungal(l.plant) ? 0 : l.qty), 0);
}

/**
 * Swap (§C.1): the next best candidate for `slot` that is not in `exclude`
 * (every plant already on the card plus the one being swapped out), as a
 * line sized for that slot. Null when the pool has nothing else for it.
 */
export function nextFor(
  input: PlanInput,
  catalog: PlannerCatalog,
  slot: Slot,
  exclude: Iterable<number>,
): PlanLine | null {
  const rules = resolveRules(catalog);
  const { pool } = eligible(input, catalog);
  const share = slotsFor(input.track, input.subgoal, input.timing).find((s) => s.slot === slot)?.share ?? 0;
  const slotQty = slotQtyFor(Math.max(0, Math.floor(input.size)), share);
  const best = bestFor(pool.values(), slot, slotQty, input, rules, new Set(exclude));
  return best ? lineFor(best, slot, slotQty) : null;
}

/**
 * Why a line scored what it did (§C.4), using the rules the catalog carries
 * (or `overrides` from the bench's what-if sliders). Pure.
 */
export function explain(
  input: PlanInput,
  catalog: PlannerCatalog,
  line: PlanLine,
  overrides?: Partial<PlannerRules>,
): ScoreExplanation {
  const rules = resolveRules(catalog, overrides);
  const share = slotsFor(input.track, input.subgoal, input.timing).find((s) => s.slot === line.slot)?.share ?? 0;
  const slotQty = slotQtyFor(Math.max(0, Math.floor(input.size)), share);
  return explainScore(line.plant, line.zoneFit, line.slot, slotQty, input, rules);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
