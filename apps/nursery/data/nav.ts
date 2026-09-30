import type { CatalogNav, CatalogNavNode } from "@grove/odoo-client";

/**
 * Mock catalog nav — the local-dev / backend-down fallback for
 * `GET /grove/api/v1/catalog/nav` (GOL-2745), exactly the seam `mock-products`
 * gives the product list.
 *
 * ── This is a FALLBACK, not the taxonomy ──────────────────────────────────
 * Odoo owns the department tree (`grove_node_kind` / `grove_dept_status` /
 * `grove_slug` / `grove_teaser` / `grove_facets` / `grove_coming_list` on
 * `product.public.category`). Launching Mycoforestry is a status flip in Odoo,
 * not an edit here. This file exists so the storefront renders — and is
 * reviewable, screenshot-able and testable — before that backend lands, and so
 * a dead Odoo shows the nav instead of a bare page.
 *
 * ⚠️ The teaser blurbs and "What's coming" lines below are PLACEHOLDERS in the
 * house voice. Per the spec, the shipping copy is authored in Odoo, drafted by
 * Sora (CMO) and approved by Josh — when that copy lands, these strings are
 * dead weight that only the mock path ever renders. Do not treat them as
 * approved brand copy.
 *
 * The slugs, order, statuses and facet sets DO mirror the spec's information
 * architecture, because the storefront's routing and tests are written against
 * them.
 */

/** `/shop` is the Orchard department — the one live department in Train #3. */
export const ORCHARD_SLUG = "orchard";

/** The Guilds collection's slug (`/shop/guilds`). */
export const GUILDS_SLUG = "guilds";

const ORCHARD: CatalogNavNode = {
  slug: ORCHARD_SLUG,
  name: "Orchard & food forest",
  kind: "department",
  status: "live",
  teaser:
    "The trees, shrubs and vines a homestead food forest is built from — grown in Appalachian ground for Appalachian winters.",
  // Today's /shop facets, unchanged (GOL-2745 keeps orchard browsing as-is).
  facets: ["zone", "layer", "sun", "uses", "on_offer"],
  comingList: [],
  // Counts are 0 in the mock: the real ones come from Odoo, and a mock count
  // that disagrees with the mock grid is worse than no count at all. The nav
  // renders a pill without a count rather than a dishonest `· 0`.
  categories: [
    { slug: "native", name: "Native", count: 0 },
    { slug: "fruit-trees", name: "Fruit Trees", count: 0 },
    { slug: "nut-trees", name: "Nut Trees", count: 0 },
    { slug: "berry-nut-shrubs", name: "Fruit & Nut Shrubs", count: 0 },
    { slug: "fruiting-vines", name: "Fruiting Vines", count: 0 },
  ],
  count: 0,
};

const MYCOFORESTRY: CatalogNavNode = {
  slug: "mycoforestry",
  name: "Mycoforestry",
  kind: "department",
  status: "coming_soon",
  teaser:
    "Host trees inoculated with truffle and porcini fungi — a nut or oak crop above ground and a mushroom crop below it, from one planting.",
  facets: ["zone", "host_tree", "fungus", "years_to_harvest"],
  comingList: [
    { name: "Burgundy truffle oak", detail: "inoculated English oak and hazel" },
    { name: "Bianchetto truffle hazel", detail: "earlier-bearing than Périgord" },
    { name: "Porcini pine", detail: "inoculated with Boletus edulis" },
  ],
  categories: [
    { slug: "truffle-trees", name: "Truffle trees", count: 0 },
    { slug: "porcini-trees", name: "Porcini trees", count: 0 },
  ],
  count: 0,
};

const FOREST_FARMING: CatalogNavNode = {
  slug: "forest-farming",
  name: "Forest farming",
  kind: "department",
  status: "coming_soon",
  teaser:
    "Medicinal and edible crops grown under an existing canopy — the woodland floor working as hard as the trees above it.",
  facets: ["zone", "shade_level", "years_to_harvest", "uses"],
  comingList: [
    { name: "Goldenseal", detail: "roots and rhizomes for shaded beds" },
    { name: "American ginseng", detail: "stratified seed and rootlets" },
    { name: "Ramps", detail: "bulbs and seed for a spring patch" },
    { name: "Black cohosh", detail: "divisions for deep shade" },
  ],
  categories: [
    { slug: "medicinal-roots", name: "Medicinal roots", count: 0 },
    { slug: "woodland-edibles", name: "Woodland edibles", count: 0 },
  ],
  count: 0,
};

const SEED_AND_SCION: CatalogNavNode = {
  slug: "seed-and-scion",
  name: "Seed & scion",
  kind: "department",
  status: "coming_soon",
  teaser:
    "Dormant scion wood, seed and rootstock for grafters and propagators — the raw material, sold by the stick and by the pound.",
  facets: ["form", "species", "ships"],
  comingList: [
    { name: "Scion wood", detail: "dormant, winter-cut, by the stick" },
    { name: "Tree seed", detail: "stratified and ready to sow" },
    { name: "Rootstock", detail: "seedling and clonal, bareroot" },
  ],
  categories: [
    { slug: "scion-wood", name: "Scion wood", count: 0 },
    { slug: "seed", name: "Seed", count: 0 },
    { slug: "rootstock", name: "Rootstock", count: 0 },
  ],
  count: 0,
};

const GUILDS: CatalogNavNode = {
  slug: GUILDS_SLUG,
  name: "Guilds",
  kind: "collection",
  status: "live",
  teaser: "Plants that grow better together.",
  facets: [],
  comingList: [],
  categories: [],
  count: 0,
};

/** The spec's information architecture, in tab order. */
export const mockCatalogNav: CatalogNav = {
  departments: [ORCHARD, MYCOFORESTRY, FOREST_FARMING, SEED_AND_SCION],
  guilds: GUILDS,
};
