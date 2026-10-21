import type { PlannerPlant, Slot, Subgoal, Timing, Track } from "./types";

export interface SlotShare {
  slot: Slot;
  share: number;
}

/**
 * The spawn slot (winter-beta spec, decisions): share 0, so the tree shares
 * are untouched and the plan takes one spawn line when the catalog has a
 * fungal plant that fits. Food forest and agroforestry only, never deer. A
 * share-0 slot is optional: an empty one is not an unfilled layer.
 */
export const MUSHROOM_SLOT: SlotShare = { slot: "mushroom", share: 0 };

/** Slot tables from §C.2, keyed by track / sub-goal / deer timing. */
export const FOOD_FOREST_SLOTS: SlotShare[] = [
  { slot: "canopy", share: 0.2 },
  { slot: "understory", share: 0.3 },
  { slot: "shrub", share: 0.4 },
  { slot: "support", share: 0.1 },
  MUSHROOM_SLOT,
];

export const AGRO_SLOTS: Record<Subgoal, SlotShare[]> = {
  alley: [
    { slot: "canopy", share: 0.5 },
    { slot: "shrub", share: 0.5 },
    MUSHROOM_SLOT,
  ],
  silvo: [
    { slot: "canopy", share: 0.7 },
    { slot: "understory", share: 0.3 },
    MUSHROOM_SLOT,
  ],
  riparian: [
    { slot: "understory", share: 0.4 },
    { slot: "shrub", share: 0.6 },
    MUSHROOM_SLOT,
  ],
  windbreak: [
    { slot: "canopy", share: 0.4 },
    { slot: "understory", share: 0.3 },
    { slot: "shrub", share: 0.3 },
    MUSHROOM_SLOT,
  ],
};

export const DEER_SLOTS: Record<"early" | "late" | "all" | "year", SlotShare[]> = {
  all: [
    { slot: "early", share: 0.5 },
    { slot: "late", share: 0.5 },
  ],
  early: [
    { slot: "early", share: 0.75 },
    { slot: "late", share: 0.25 },
  ],
  late: [
    { slot: "early", share: 0.25 },
    { slot: "late", share: 0.75 },
  ],
  year: [
    { slot: "early", share: 0.4 },
    { slot: "late", share: 0.4 },
    { slot: "offseason", share: 0.2 },
  ],
};

/** Deer seasons from `harvest_months` (§C.2). */
export const EARLY_MONTHS = [8, 9, 10] as const;
export const LATE_MONTHS = [11, 12, 1, 2] as const;
export const OFFSEASON_MONTHS = [4, 5, 6, 7] as const;

export function slotsFor(track: Track, subgoal: Subgoal | undefined, timing: Timing): SlotShare[] {
  if (track === "food") return FOOD_FOREST_SLOTS;
  if (track === "agro") return AGRO_SLOTS[subgoal ?? "alley"];
  switch (timing) {
    case "early":
    case "late":
    case "year":
      return DEER_SLOTS[timing];
    default:
      return DEER_SLOTS.all;
  }
}

function hasAny(months: readonly number[], set: readonly number[]): boolean {
  return months.some((m) => set.includes(m));
}

export type DeerSeason = "early" | "late" | "both" | "offseason" | null;

/**
 * Which deer slot a plant can fill: early (any of Aug to Oct), late (any of
 * Nov to Feb), both, or offseason (Apr to Jul and none of the others).
 */
export function deerSeason(plant: Pick<PlannerPlant, "harvest_months">): DeerSeason {
  const months = plant.harvest_months ?? [];
  const early = hasAny(months, EARLY_MONTHS);
  const late = hasAny(months, LATE_MONTHS);
  if (early && late) return "both";
  if (early) return "early";
  if (late) return "late";
  if (hasAny(months, OFFSEASON_MONTHS)) return "offseason";
  return null;
}

/** A support plant is any layer with an empty `harvest_months` (pollinator and nurse plants). */
export function isSupport(plant: Pick<PlannerPlant, "harvest_months" | "layer">): boolean {
  return !isFungal(plant) && (plant.harvest_months ?? []).length === 0;
}

/** Mushroom spawn: the `fungal` layer (winter-beta spec §A). */
export function isFungal(plant: Pick<PlannerPlant, "layer">): boolean {
  return plant.layer === "fungal";
}

/**
 * Whether `plant` may fill `slot` on this track. Layer slots on the food-forest
 * track are reserved for plants that actually crop, so a nurse tree never
 * takes the canopy share meant for a chestnut.
 */
export function fitsSlot(plant: PlannerPlant, slot: Slot, track: Track): boolean {
  // Spawn fills the mushroom slot and nothing else; a harvest month on a
  // shiitake must never land it in a deer plot or a fruiting layer.
  if (isFungal(plant)) return slot === "mushroom" && track !== "deer";
  switch (slot) {
    case "canopy":
    case "understory":
    case "shrub":
      return plant.layer === slot && (track !== "food" || !isSupport(plant));
    case "support":
      return isSupport(plant);
    case "mushroom":
      return false;
    case "early": {
      const s = deerSeason(plant);
      return s === "early" || s === "both";
    }
    case "late": {
      const s = deerSeason(plant);
      return s === "late" || s === "both";
    }
    case "offseason":
      return deerSeason(plant) === "offseason";
  }
}

/** Months counted "in season" for a deer slot's +4-per-month bonus. */
export function seasonMonths(slot: Slot): readonly number[] {
  switch (slot) {
    case "early":
      return EARLY_MONTHS;
    case "late":
      return LATE_MONTHS;
    case "offseason":
      return OFFSEASON_MONTHS;
    default:
      return [];
  }
}
