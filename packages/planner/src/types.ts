/**
 * Planner types (order-builder design spec, 2026-10-14, §B feed shape + §C.2).
 *
 * The plant and bundle rows are the catalog feed exactly as grove_headless
 * serialises them (`GET /grove/api/v1/planner/catalog`, snake_case), so the
 * storefront passes the BFF payload straight in with no normaliser layer. The
 * one storefront-side addition is `variant_id`: the feed carries template ids,
 * and the cart keys lines by `product.product`, so the BFF resolves it before
 * the catalog reaches the browser.
 */

/** What the spot is like (quiz question 2). */
export type Site = "open" | "wet" | "poor" | "shade";

/** What the customer is trying to do (question 3), in the spec's order. */
export type Track = "food" | "agro" | "deer";

/** Agroforestry sub-goal (question 3, agro track only). */
export type Subgoal = "alley" | "silvo" | "riparian" | "windbreak";

/**
 * When they want a harvest (question 4). Food forest and agroforestry use
 * `fast | patient | mixed`; the deer track uses `early | late | all | year`.
 */
export type Timing = "fast" | "patient" | "mixed" | "early" | "late" | "all" | "year";

/** Feed `layer` values the planner places (ground cover and vines have no slot). */
export type Layer = "canopy" | "understory" | "shrub";

/** A slot is a layer (or a deer season) with a share of the total tree count. */
export type Slot = Layer | "support" | "early" | "late" | "offseason";

export type ZoneFit = "safe" | "marginal";

export type WildlifeValue = "high" | "medium" | "low";

export interface PlannerTolerates {
  wet: boolean;
  poor_soil: boolean;
  shade: boolean;
}

export interface PlannerPlant {
  id: number;
  slug: string;
  name: string;
  botanical_name: string;
  genus: string;
  price: number;
  tier: string | null;
  pickup_only: boolean;
  in_stock: boolean;
  preorder_cap_reached: boolean;
  layer: string | null;
  zone_min: number | null;
  zone_max: number | null;
  years_to_fruit_min: number | null;
  pollination_min: number | null;
  harvest_months: number[];
  tolerates: PlannerTolerates;
  wildlife_value: WildlifeValue | null;
  priority: number | null;
  blocked_states: string[];
  substitute_id: number | null;
  image: string | null;
  /** product.product id for the cart line; resolved by the storefront BFF. */
  variant_id?: number | null;
}

export interface PlannerBundle {
  id: number;
  slug: string;
  name: string;
  price: number;
  /** Component TEMPLATE ids repeated per unit; empty for a consult-built mix. */
  component_ids: number[];
  consult_built: boolean;
  tree_count?: number;
  image?: string | null;
  /** product.product id for the cart line; resolved by the storefront BFF. */
  variant_id?: number | null;
}

export interface PlannerCatalog {
  generated_at?: string;
  /** Green states, sorted; the storefront never carries its own copy. */
  states: string[];
  /** `[cold, warm]` USDA band per green state, for the unknown-ZIP fallback. */
  state_zones: Record<string, [number, number]>;
  plants: PlannerPlant[];
  bundles: PlannerBundle[];
}

/**
 * Where they are planting: a USDA zone from the ZIP lookup, or the state's
 * `[cold, warm]` band when the ZIP is unknown.
 */
export type ZoneInput = number | { band: [number, number] };

export interface PlanInput {
  zone: ZoneInput;
  /** Two-letter state for the compliance gate; null when unknown. */
  state: string | null;
  site: Site;
  track: Track;
  subgoal?: Subgoal;
  /** Total tree count the customer asked for. */
  size: number;
  timing: Timing;
}

export interface PlanLine {
  plant: PlannerPlant;
  qty: number;
  slot: Slot;
  zoneFit: ZoneFit;
  /** "needs N to pollinate" when the pollination floor raised the quantity. */
  note?: string;
}

export interface Substitution {
  from: PlannerPlant;
  to: PlannerPlant;
  state: string;
}

export interface BundleOffer {
  id: number;
  name: string;
  price: number;
  /** Dollars saved against the lines the bundle replaces (0 for consult-built). */
  saves: number;
  /** Trees the bundle covers. */
  covers: number;
  consultBuilt: boolean;
  /** Component template ids the bundle replaces (empty for consult-built). */
  componentIds: number[];
  variantId: number | null;
}

export type PlanStatus = "ok" | "partial" | "empty";

export interface PlanResult {
  status: PlanStatus;
  lines: PlanLine[];
  substitutions: Substitution[];
  /** Would have been picked but is out of stock or cap-reached. */
  notify: PlannerPlant[];
  bundle?: BundleOffer;
  subtotal: number;
  treeCount: number;
  /** Drives only the "Talk it through first" link; checkout decides the $0 line. */
  consult: boolean;
  harvestMonths: number[];
  /** Slots the plan could not fill (empty when status is "ok"). */
  unfilled: Slot[];
}
