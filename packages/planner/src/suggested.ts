import { eligible, score, type Candidate } from "./plan";
import { resolveRules } from "./rules";
import { deerSeason, isFungal, isSupport } from "./slots";
import type {
  PlanInput,
  PlanLine,
  PlanResult,
  PlannerCatalog,
  PlannerPlant,
  PlannerRole,
  Slot,
  Stratum,
  ZoneFit,
} from "./types";

/** Strata in planting order (winter-beta spec §C.1): overstory, understory, mushroom. */
export const STRATA: readonly Stratum[] = ["overstory", "understory", "mushroom"];

/** §A.1, for a feed row that carries a layer but no stratum (or a pre-beta fixture). */
export function stratumOf(plant: Pick<PlannerPlant, "layer" | "stratum">): Stratum | null {
  if (plant.stratum) return plant.stratum;
  switch (plant.layer) {
    case "canopy":
      return "overstory";
    case "understory":
    case "shrub":
    case "vine":
    case "ground":
      return "understory";
    case "fungal":
      return "mushroom";
    default:
      return null;
  }
}

const STRATUM_RANK: Record<Stratum, number> = { overstory: 0, understory: 1, mushroom: 2 };
const ROLE_RANK: Record<PlannerRole, number> = { anchor: 0, companion: 1 };

/**
 * Lines in planting order (§C.1): stratum, then anchors before companions,
 * then the engine's own order. A line with no stratum sorts with the
 * understory; one with no role sorts after the companions. Stable, pure.
 */
export function orderLines<T extends { plant: Pick<PlannerPlant, "layer" | "stratum" | "role"> }>(lines: readonly T[]): T[] {
  return lines
    .map((line, i) => ({ line, i }))
    .sort((a, b) => rank(a.line.plant) - rank(b.line.plant) || a.i - b.i)
    .map(({ line }) => line);
}

function rank(plant: Pick<PlannerPlant, "layer" | "stratum" | "role">): number {
  const s = stratumOf(plant);
  const r = plant.role ?? null;
  return (s ? STRATUM_RANK[s] : 1) * 10 + (r ? ROLE_RANK[r] : 2);
}

export interface SuggestedPlant {
  plant: PlannerPlant;
  zoneFit: ZoneFit;
  /** The slot the engine would place it in; what a hand add is sized to. */
  slot: Slot;
  score: number;
}

export interface SuggestedGroups {
  groups: Record<Stratum, SuggestedPlant[]>;
  /** Shippable plants the zone or site filter hid for this spot. */
  hidden: number;
  /** Everything suggested, flat and in score order within stratum. */
  all: SuggestedPlant[];
}

/** The slot a plant would naturally fill on this track. */
export function naturalSlot(plant: PlannerPlant, track: PlanInput["track"]): Slot {
  if (isFungal(plant)) return "mushroom";
  if (track === "deer") {
    const s = deerSeason(plant);
    return s === "late" ? "late" : s === "offseason" ? "offseason" : "early";
  }
  if (isSupport(plant)) return "support";
  const layer = plant.layer;
  return layer === "canopy" || layer === "understory" || layer === "shrub" ? layer : "shrub";
}

/**
 * `suggested(input, catalog, result)` (§C.2): the eligible plants (same
 * filter as the engine) that are not in the result, grouped by stratum and
 * sorted by score, plus how many the site hid. `placed` adds ids the card
 * already shows (manual lines) so Add never offers a plant twice.
 */
export function suggested(
  input: PlanInput,
  catalog: PlannerCatalog,
  result: Pick<PlanResult, "lines">,
  placed: Iterable<number> = [],
): SuggestedGroups {
  const rules = resolveRules(catalog);
  const { pool, hidden } = eligible(input, catalog);
  const taken = new Set<number>([...result.lines.map((l) => l.plant.id), ...placed]);
  const groups: Record<Stratum, SuggestedPlant[]> = { overstory: [], understory: [], mushroom: [] };
  for (const c of pool.values()) {
    if (taken.has(c.plant.id)) continue;
    const stratum = stratumOf(c.plant);
    if (!stratum) continue;
    if (stratum === "mushroom" && input.track === "deer") continue;
    const slot = naturalSlot(c.plant, input.track);
    groups[stratum].push({ plant: c.plant, zoneFit: c.zoneFit, slot, score: score(c.plant, c.zoneFit, slot, 1, input, rules) });
  }
  for (const stratum of STRATA) {
    groups[stratum].sort((a, b) => b.score - a.score || a.plant.id - b.plant.id);
  }
  return { groups, hidden, all: STRATA.flatMap((s) => groups[s]) };
}

/** A hand-added line (§C.2): `qty = max(1, pollination_min)`, marked manual. */
export function manualLine(pick: Pick<SuggestedPlant, "plant" | "zoneFit" | "slot">): PlanLine {
  const qty = Math.max(1, pick.plant.pollination_min ?? 1);
  return { plant: pick.plant, qty, slot: pick.slot, zoneFit: pick.zoneFit, manual: true };
}

/**
 * Which of the customer's hand picks still stand after Edit (§C.2): those
 * that pass the new filter and were not placed by the new result, as lines.
 */
export function survivingManual(
  input: PlanInput,
  catalog: PlannerCatalog,
  result: Pick<PlanResult, "lines">,
  manualIds: readonly number[],
): PlanLine[] {
  if (manualIds.length === 0) return [];
  const { pool } = eligible(input, catalog);
  const placed = new Set(result.lines.map((l) => l.plant.id));
  const out: PlanLine[] = [];
  for (const id of manualIds) {
    const c: Candidate | undefined = pool.get(id);
    if (!c || placed.has(id)) continue;
    if (isFungal(c.plant) && input.track === "deer") continue;
    out.push(manualLine({ plant: c.plant, zoneFit: c.zoneFit, slot: naturalSlot(c.plant, input.track) }));
  }
  return out;
}
