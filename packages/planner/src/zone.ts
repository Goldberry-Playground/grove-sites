import type { PlannerPlant, ZoneFit, ZoneInput } from "./types";

/**
 * Zone fit (§C.2 filter): `zone_min <= zone <= zone_max` is safe, one zone
 * outside on either end is marginal, further out is excluded (null).
 *
 * For a state band (unknown ZIP) the plant is safe when it covers the whole
 * band and marginal when it merely overlaps it (§C.1). A plant with no zone
 * facts is never recommended, mirroring the §A ready flag.
 */
export function zoneFit(plant: Pick<PlannerPlant, "zone_min" | "zone_max">, zone: ZoneInput): ZoneFit | null {
  const min = plant.zone_min;
  const max = plant.zone_max;
  if (min == null || max == null) return null;
  if (typeof zone === "number") {
    if (zone >= min && zone <= max) return "safe";
    if (zone === min - 1 || zone === max + 1) return "marginal";
    return null;
  }
  const [cold, warm] = zone.band;
  if (min <= cold && max >= warm) return "safe";
  if (min <= warm && max >= cold) return "marginal";
  return null;
}

/** The band the planner runs on for a state the ZIP lookup could not place. */
export function stateBand(
  stateZones: Record<string, [number, number]>,
  state: string,
): [number, number] | null {
  const band = stateZones[state];
  return band && band.length === 2 ? band : null;
}
