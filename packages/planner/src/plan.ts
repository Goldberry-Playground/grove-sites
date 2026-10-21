import { matchBundle } from "./bundle";
import { fitsSlot, deerSeason, seasonMonths, slotsFor } from "./slots";
import type {
  PlanInput,
  PlanLine,
  PlanResult,
  PlannerCatalog,
  PlannerPlant,
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

interface Candidate {
  plant: PlannerPlant;
  zoneFit: ZoneFit;
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

/** Score per candidate within a slot (§C.2); higher wins. */
export function score(
  plant: PlannerPlant,
  fit: ZoneFit,
  slot: Slot,
  slotQty: number,
  input: Pick<PlanInput, "track" | "timing">,
): number {
  const priority = plant.priority ?? DEFAULT_PRIORITY;
  const years = plant.years_to_fruit_min ?? 0;
  let s = 100 - 2 * priority - 1.5 * years;
  if (fit === "marginal") s -= 40;
  if (input.track !== "deer") {
    if (input.timing === "fast") s -= 3 * years;
    else if (input.timing === "patient") s += 2 * years;
  } else {
    const inSeason = seasonMonths(slot);
    s += 4 * plant.harvest_months.filter((m) => inSeason.includes(m)).length;
    if (plant.wildlife_value === "high") s += 10;
    // A plant that drops in both seasons fills either slot, scored 10 lower in
    // early so a true early tree wins there (Whitetail's rule, kept).
    if (slot === "early" && deerSeason(plant) === "both") s -= 10;
  }
  if ((plant.pollination_min ?? 1) > slotQty + 2) s -= 20;
  return s;
}

/**
 * `plan(input, catalog)`: the whole order builder as one pure function.
 * Same input and catalog give the same result; ties break on `id`. No Date,
 * no random, no network.
 */
export function plan(input: PlanInput, catalog: PlannerCatalog): PlanResult {
  const byId = new Map<number, PlannerPlant>();
  for (const p of catalog.plants) byId.set(p.id, p);

  const pool = new Map<number, Candidate>();
  const notify = new Map<number, PlannerPlant>();
  const substitutions: Substitution[] = [];
  const state = input.state;

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
    if (!fit) continue;
    if (!siteOk(plant, input.site)) continue;
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

  const slots = slotsFor(input.track, input.subgoal, input.timing).filter((s) => s.share > 0);
  const lines: PlanLine[] = [];
  const unfilled: Slot[] = [];
  const used = new Set<number>();
  const total = Math.max(0, Math.floor(input.size));

  for (const { slot, share } of slots) {
    // A slot with fewer than 2 trees' share still gets 1 line if a candidate exists.
    const slotQty = Math.max(1, Math.round(total * share));
    const ranked = [...pool.values()]
      .filter((c) => !used.has(c.plant.id) && fitsSlot(c.plant, slot, input.track))
      .map((c) => ({ c, s: score(c.plant, c.zoneFit, slot, slotQty, input) }))
      .sort((a, b) => b.s - a.s || a.c.plant.id - b.c.plant.id);
    const best = ranked[0]?.c;
    if (!best) {
      unfilled.push(slot);
      continue;
    }
    used.add(best.plant.id);
    const floor = best.plant.pollination_min ?? 1;
    const qty = Math.max(slotQty, floor);
    const line: PlanLine = { plant: best.plant, qty, slot, zoneFit: best.zoneFit };
    if (qty > slotQty) line.note = `needs ${floor} to pollinate`;
    lines.push(line);
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
  const treeCount = lines.reduce((sum, l) => sum + l.qty, 0);
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
