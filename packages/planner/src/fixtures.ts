import type { PlannerBundle, PlannerCatalog, PlannerPlant } from "./types";

/**
 * Fixture catalog (§C.5): every layer and tolerance, a support plant per layer,
 * each carve-out genus with and without a substitute, an out-of-stock and a
 * cap-reached plant, a pickup-only plant, and a pollination floor above the
 * smallest slot. Ids are synthetic (1xx) so they can never collide with a real
 * template; the nursery dev fallback serves this same catalog when Odoo is
 * unreachable, exactly like the mock product list does for /shop.
 */

type PlantSeed = Partial<PlannerPlant> &
  Pick<PlannerPlant, "id" | "slug" | "name" | "botanical_name" | "genus" | "price" | "layer">;

function plant(seed: PlantSeed): PlannerPlant {
  return {
    tier: "bareroot",
    pickup_only: false,
    in_stock: true,
    preorder_cap_reached: false,
    zone_min: 4,
    zone_max: 8,
    years_to_fruit_min: 3,
    pollination_min: 1,
    harvest_months: [],
    tolerates: { wet: false, poor_soil: false, shade: false },
    wildlife_value: null,
    priority: 50,
    blocked_states: [],
    substitute_id: null,
    image: null,
    variant_id: seed.id * 10 + 1,
    ...seed,
  };
}

export const FIXTURE_PLANTS: PlannerPlant[] = [
  plant({
    id: 101, slug: "american-chestnut-hybrid", name: "American Chestnut (hybrid)",
    botanical_name: "Castanea dentata x mollissima", genus: "castanea", price: 28,
    layer: "canopy", zone_min: 4, zone_max: 8, years_to_fruit_min: 4, pollination_min: 2,
    harvest_months: [9, 10], tolerates: { wet: false, poor_soil: true, shade: false },
    wildlife_value: "high", priority: 10, blocked_states: ["WA", "OR", "FL"], substitute_id: 109,
  }),
  plant({
    id: 102, slug: "american-persimmon", name: "American Persimmon",
    botanical_name: "Diospyros virginiana", genus: "diospyros", price: 18,
    layer: "understory", zone_min: 5, zone_max: 9, years_to_fruit_min: 4, pollination_min: 2,
    harvest_months: [9, 10, 11], tolerates: { wet: true, poor_soil: true, shade: false },
    wildlife_value: "high", priority: 20, blocked_states: ["CA"],
  }),
  plant({
    id: 103, slug: "pawpaw", name: "Pawpaw", botanical_name: "Asimina triloba", genus: "asimina",
    price: 22, tier: "potted", layer: "understory", zone_min: 5, zone_max: 8,
    years_to_fruit_min: 5, pollination_min: 2, harvest_months: [8, 9],
    tolerates: { wet: true, poor_soil: false, shade: true }, wildlife_value: "medium", priority: 30,
  }),
  plant({
    id: 104, slug: "american-hazelnut", name: "American Hazelnut",
    botanical_name: "Corylus americana", genus: "corylus", price: 12, layer: "shrub",
    zone_min: 4, zone_max: 8, years_to_fruit_min: 3, pollination_min: 2, harvest_months: [8, 9],
    tolerates: { wet: false, poor_soil: true, shade: true }, wildlife_value: "high", priority: 20,
  }),
  plant({
    id: 105, slug: "elderberry", name: "Elderberry", botanical_name: "Sambucus canadensis",
    genus: "sambucus", price: 10, layer: "shrub", zone_min: 3, zone_max: 8,
    years_to_fruit_min: 2, pollination_min: 2, harvest_months: [7, 8],
    tolerates: { wet: true, poor_soil: true, shade: true }, wildlife_value: "medium", priority: 40,
  }),
  plant({
    id: 106, slug: "aronia", name: "Aronia", botanical_name: "Aronia melanocarpa", genus: "aronia",
    price: 10, tier: "potted", layer: "shrub", zone_min: 3, zone_max: 7, years_to_fruit_min: 2,
    pollination_min: 1, harvest_months: [8, 9], tolerates: { wet: true, poor_soil: true, shade: false },
    wildlife_value: "low", priority: 45,
  }),
  plant({
    id: 107, slug: "red-mulberry", name: "Red Mulberry", botanical_name: "Morus rubra",
    genus: "morus rubra", price: 16, layer: "canopy", zone_min: 5, zone_max: 9,
    years_to_fruit_min: 3, pollination_min: 1, harvest_months: [6, 7],
    tolerates: { wet: true, poor_soil: true, shade: true }, wildlife_value: "high", priority: 35,
  }),
  plant({
    id: 108, slug: "eastern-redbud", name: "Eastern Redbud", botanical_name: "Cercis canadensis",
    genus: "cercis", price: 14, layer: "understory", zone_min: 4, zone_max: 9,
    years_to_fruit_min: null, pollination_min: null, harvest_months: [],
    tolerates: { wet: false, poor_soil: true, shade: true }, wildlife_value: "low", priority: 30,
  }),
  plant({
    id: 109, slug: "shagbark-hickory", name: "Shagbark Hickory", botanical_name: "Carya ovata",
    genus: "carya", price: 20, layer: "canopy", zone_min: 4, zone_max: 8, years_to_fruit_min: 10,
    pollination_min: 2, harvest_months: [9, 10], tolerates: { wet: false, poor_soil: true, shade: false },
    wildlife_value: "high", priority: 30, blocked_states: ["AZ", "NM"],
  }),
  plant({
    id: 110, slug: "sawtooth-oak", name: "Sawtooth Oak", botanical_name: "Quercus acutissima",
    genus: "quercus", price: 15, layer: "canopy", zone_min: 5, zone_max: 9, years_to_fruit_min: 6,
    pollination_min: 1, harvest_months: [9, 10, 11, 12], in_stock: false,
    tolerates: { wet: false, poor_soil: true, shade: false }, wildlife_value: "high", priority: 25,
  }),
  plant({
    id: 111, slug: "american-plum", name: "American Plum", botanical_name: "Prunus americana",
    genus: "prunus", price: 14, layer: "understory", zone_min: 3, zone_max: 8,
    years_to_fruit_min: 3, pollination_min: 2, harvest_months: [8, 9],
    tolerates: { wet: false, poor_soil: true, shade: false }, wildlife_value: "medium", priority: 40,
    blocked_states: ["WA", "OR"], substitute_id: 112,
  }),
  plant({
    id: 112, slug: "jujube", name: "Jujube", botanical_name: "Ziziphus jujuba", genus: "ziziphus",
    price: 24, tier: "potted", layer: "understory", zone_min: 6, zone_max: 9,
    years_to_fruit_min: 2, pollination_min: 1, harvest_months: [9, 10],
    tolerates: { wet: false, poor_soil: true, shade: false }, wildlife_value: "medium", priority: 45,
  }),
  plant({
    id: 113, slug: "buttonbush", name: "Buttonbush", botanical_name: "Cephalanthus occidentalis",
    genus: "cephalanthus", price: 12, tier: "potted", layer: "shrub", zone_min: 5, zone_max: 9,
    years_to_fruit_min: null, pollination_min: null, harvest_months: [],
    tolerates: { wet: true, poor_soil: false, shade: true }, wildlife_value: "medium", priority: 50,
  }),
  plant({
    id: 114, slug: "crabapple", name: "Wildlife Crabapple", botanical_name: "Malus 'Dolgo'",
    genus: "malus", price: 16, layer: "understory", zone_min: 4, zone_max: 8,
    years_to_fruit_min: 3, pollination_min: 1, harvest_months: [9, 10, 11],
    preorder_cap_reached: true, tolerates: { wet: false, poor_soil: true, shade: false },
    wildlife_value: "high", priority: 35,
  }),
  plant({
    id: 115, slug: "black-walnut", name: "Black Walnut", botanical_name: "Juglans nigra",
    genus: "juglans", price: 18, layer: "canopy", zone_min: 4, zone_max: 9, years_to_fruit_min: 8,
    pollination_min: 1, harvest_months: [9, 10], pickup_only: true,
    tolerates: { wet: false, poor_soil: true, shade: false }, wildlife_value: "high", priority: 30,
  }),
  plant({
    id: 116, slug: "flowering-dogwood", name: "Flowering Dogwood", botanical_name: "Cornus florida",
    genus: "cornus", price: 16, layer: "understory", zone_min: 5, zone_max: 9,
    years_to_fruit_min: null, pollination_min: null, harvest_months: [],
    tolerates: { wet: false, poor_soil: false, shade: true }, wildlife_value: "medium", priority: 40,
    blocked_states: ["FL"],
  }),
];

export const FIXTURE_BUNDLES: PlannerBundle[] = [
  {
    id: 132, slug: "hazel-hedge", name: "Hazel Hedge", price: 40,
    component_ids: [104, 104, 104, 104, 108], consult_built: false, variant_id: 1321,
  },
  {
    id: 133, slug: "wet-corner", name: "Wet Corner", price: 44,
    component_ids: [102, 102, 105, 105, 113], consult_built: false, variant_id: 1331,
  },
  {
    id: 134, slug: "homestead-food-forest-50", name: "Homestead Food Forest (50 trees)",
    price: 200, component_ids: [], consult_built: true, tree_count: 50, variant_id: 1341,
  },
  {
    id: 135, slug: "centennial-food-forest-100", name: "Centennial Food Forest (100 trees)",
    price: 400, component_ids: [], consult_built: true, tree_count: 100, variant_id: 1351,
  },
];

/** `GREEN_STATES` sorted, mirrored from grove_headless `shipping_zones.py`. */
export const FIXTURE_STATES: string[] = [
  "AL", "AR", "CT", "DC", "DE", "FL", "GA", "IA", "IL", "IN", "KY", "LA", "MA", "MD", "ME", "MI",
  "MN", "MO", "MS", "NC", "NH", "NJ", "NY", "OH", "PA", "RI", "SC", "TN", "VA", "VT", "WI", "WV",
];

/** `STATE_ZONE_BANDS`, mirrored from grove_headless `shipping_zones.py` (GOL-3379). */
export const FIXTURE_STATE_ZONES: Record<string, [number, number]> = {
  AL: [7, 9], AR: [6, 8], CT: [5, 7], DC: [7, 8], DE: [7, 8], FL: [8, 11], GA: [7, 9], IA: [4, 6],
  IL: [5, 7], IN: [5, 7], KY: [6, 7], LA: [8, 9], MA: [5, 7], MD: [6, 8], ME: [3, 6], MI: [4, 6],
  MN: [3, 5], MO: [5, 7], MS: [7, 9], NC: [5, 8], NH: [3, 6], NJ: [6, 7], NY: [3, 7], OH: [5, 6],
  PA: [5, 7], RI: [6, 7], SC: [7, 9], TN: [6, 8], VA: [5, 8], VT: [3, 5], WI: [3, 5], WV: [5, 7],
};

export const FIXTURE_CATALOG: PlannerCatalog = {
  generated_at: "2026-10-21T00:00:00Z",
  states: FIXTURE_STATES,
  state_zones: FIXTURE_STATE_ZONES,
  plants: FIXTURE_PLANTS,
  bundles: FIXTURE_BUNDLES,
};
