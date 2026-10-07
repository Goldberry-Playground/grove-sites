/**
 * Per-product `<title>` and `<meta description>` copy for the nursery PDPs.
 *
 * Provenance: staged by CMO-Sora on **GOL-2875** (second pass, 2026-10-01),
 * verified against the live prod feed and `product.template` over xmlrpc. This
 * is a *seed*, not the source of truth — see the precedence rule below.
 *
 * Why a baked table at all: the grove API product serializer does not expose
 * `grove_seo_description` today (GOL-2875 correction C3), so there is no feed
 * field to read. Baking the copy here is what gets 21 pages off a single shared
 * title; exposing the Odoo field (filed separately) is what later lets Macy and
 * Sora edit it without a deploy.
 *
 * ## Precedence (implemented in `lib/pdp-metadata.ts`)
 *   1. `product.seoDescription` from the feed, when it clears the length floor.
 *   2. This table, keyed by Odoo `product.template` id.
 *   3. A derived, claim-free fallback.
 *
 * The feed wins deliberately: the moment the Odoo field is exposed, editing it
 * in Odoo must beat this file, or marketing is blocked on engineering again.
 *
 * ## Accuracy rules this copy holds to — keep them if you edit it
 * - **No hardiness-zone numbers.** The PDP's `ZoneCheck` component is the
 *   surface for that; a baked zone claim we cannot source is worse than none.
 * - **No stock state.** Id 132 flipped `in_stock` false → true inside one day
 *   during the GOL-2875 audit. A meta description is cached by Google for
 *   weeks; stock honesty belongs on-page and in the JSON-LD `availability`,
 *   which is computed per request.
 * - **Binomials only where the product name pins one species.** The generic
 *   listings (apple, peach, pear, plum, fig, mulberry, dogwood, jujube) assert
 *   no species, because the catalog does not say which.
 * - **Id 93 American Chestnut carries no binomial and no genetic claim** —
 *   pure *Castanea dentata* vs backcross is the open question on GOL-2874. It
 *   is also `grove_pickup_only`, so its copy promises no shipping.
 *
 * Titles are the LEFT side only; `app/layout.tsx` appends
 * `" | At The Grove Nursery"` via `title.template`. Rendered lengths 42–60.
 */
export interface PdpSeoCopy {
  /** Odoo product name at the time of staging — a drift tripwire, not output. */
  name: string;
  /**
   * The slug this copy was written against — the *target* form from the
   * GOL-2875 §2 keyword map. Several (8, 19, 132, 133, 135, and 22 pending the
   * product rename) do not match the live `grove_slug` yet; those renames land
   * with the Phase 2 slug route and its alias table. Documentation only —
   * nothing reads it in
   * Phase 1, where the route is still `/shop/<id>`.
   */
  slug: string;
  /** Left side of the title; the brand suffix comes from `title.template`. */
  title: string;
  description: string;
}

export const PDP_SEO_COPY: Readonly<Record<number, PdpSeoCopy>> = {
  3: {
    name: "Apple",
    slug: "apple",
    title: "Apple Trees for Appalachian Orchards",
    description:
      "Apple trees grown for Appalachian ground and West Virginia weather. Nursery stock from our hilltop farm, sized for a homestead orchard.",
  },
  4: {
    name: "American Persimmon",
    slug: "american-persimmon",
    title: "American Persimmon Trees",
    description:
      "American persimmon (Diospyros virginiana) is a tough native fruit tree for food forests and reforesting. Seedling stock from our WV nursery.",
  },
  5: {
    name: "American Plum",
    slug: "american-plum",
    title: "American Plum Trees — Native Fruit",
    description:
      "American plum (Prunus americana) is a thicket-forming native that fruits young. Seedling stock for hedgerows, food forests, and wildlife plantings.",
  },
  8: {
    name: "Chestnut - Hybrid",
    slug: "hybrid-chestnut",
    title: "Hybrid Chestnut Trees",
    description:
      "Hybrid chestnut seedlings grown for blight tolerance and nut production. Raised in West Virginia for homestead orchards and agroforestry plantings.",
  },
  9: {
    name: "Dogwood",
    slug: "dogwood",
    title: "Dogwood Trees for Woodland Edges",
    description:
      "Dogwood from our West Virginia nursery — an understory tree for woodland edges, pollinator plantings, and songbird habitat. Grown on our hilltop.",
  },
  10: {
    name: "Fig",
    slug: "fig",
    title: "Fig Trees for West Virginia",
    description:
      "Fig trees for Appalachian growers willing to site them well. Nursery stock from our hilltop farm, with honest advice on winter protection.",
  },
  11: {
    name: "Jujube",
    slug: "jujube",
    title: "Jujube Trees for Sale",
    description:
      "Jujube is a drought-tough fruit tree that shrugs off poor ground and a late frost. Nursery stock from our West Virginia hilltop for homestead orchards.",
  },
  13: {
    name: "Mulberry",
    slug: "mulberry",
    title: "Mulberry Trees for Sale",
    description:
      "Mulberry fruits heavily and young — one of the fastest paths to a real harvest on a new homestead. Nursery-grown stock from our West Virginia farm.",
  },
  14: {
    name: "Peach",
    slug: "peach",
    title: "Peach Trees for Appalachian Orchards",
    description:
      "Peach trees sized for a homestead orchard and grown for Appalachian ground. Nursery stock raised on our West Virginia hilltop farm.",
  },
  15: {
    name: "Pear",
    slug: "pear",
    title: "Pear Trees for Homestead Orchards",
    description:
      "Pear trees for the homestead orchard — long-lived, forgiving, and productive on Appalachian ground. Grown on our West Virginia hilltop.",
  },
  17: {
    name: "Plum",
    slug: "plum",
    title: "Plum Trees for Sale",
    description:
      "Plum trees for homestead orchards and food-forest plantings, grown on our West Virginia hilltop. Looking for the native? See our American plum.",
  },
  19: {
    name: "Service Berry",
    slug: "serviceberry",
    title: "Serviceberry Trees & Shrubs",
    description:
      "Serviceberry (Amelanchier) gives early bloom, June berries, and fall color in one native plant. Nursery stock from our West Virginia hilltop.",
  },
  22: {
    // Prod still carries the pre-GOL-2882 name "Chestnut Grove (5-Tree Native
    // Bundle)"; the Remembrance/Guilds rename is in code but not yet deployed.
    // Copy tracks the LIVE name so the title and the <h1> never disagree.
    name: "Chestnut Grove (5-Tree Native Bundle)",
    slug: "chestnut-grove-5-tree-native-bundle",
    title: "Chestnut Grove — 5-Tree Native Bundle",
    description:
      "Five native trees with American chestnut at the center, matched to your growing zone. A planned planting rather than five picks from a catalog.",
  },
  87: {
    name: "Black Walnut",
    slug: "black-walnut",
    title: "Black Walnut Trees for Sale",
    description:
      "Black walnut (Juglans nigra) for timber, nuts, and a century of shade. Seedling stock from our West Virginia nursery — plant it where it can stay.",
  },
  91: {
    name: "PawPaw",
    slug: "pawpaw",
    title: "Pawpaw Trees — Air-Pruned Roots",
    description:
      "Pawpaw (Asimina triloba) is the largest native fruit in North America. Our air-pruned trees build a fibrous root system for a stronger transplant.",
  },
  93: {
    name: "American Chestnut",
    slug: "american-chestnut",
    title: "American Chestnut — Farm Pickup",
    description:
      "American chestnut seedlings from our hilltop nursery. Farm pickup only — these do not ship. The tree our whole orchard was planted around.",
  },
  132: {
    name: "Mountain Mama Package (5-Tree Appalachian Mix)",
    slug: "mountain-mama-appalachian-tree-package",
    title: "Mountain Mama — 5 Appalachian Trees",
    description:
      "Five Appalachian trees in one package, picked to suit West Virginia ground. A simple way to start a food forest without choosing species one by one.",
  },
  133: {
    name: "Pollinator Bundle (5 Seedlings)",
    slug: "pollinator-tree-bundle",
    title: "Pollinator Tree Bundle — 5 Seedlings",
    description:
      "Five flowering seedlings chosen to feed pollinators across the season, not just one week of bloom. Grown on our West Virginia hilltop.",
  },
  134: {
    name: "Centennial Food Forest (100 Trees)",
    slug: "centennial-food-forest-100-trees",
    title: "Centennial Food Forest — 100 Trees",
    description:
      "One hundred trees to plant a food forest at real scale. Species mix planned with you and grown at our West Virginia nursery for Appalachian ground.",
  },
  135: {
    name: "At the Grove Food Forest (50)",
    slug: "food-forest-package-50-trees",
    title: "Food Forest Package — 50 Trees",
    description:
      "Fifty trees, planned as one planting rather than fifty separate choices. Our food forest package for homesteads and agroforestry acreage.",
  },
  140: {
    name: "Heirloom Fruit Package (5 Trees)",
    slug: "heirloom-fruit-package-5-trees",
    title: "Heirloom Fruit Package — 5 Trees",
    description:
      "Five heirloom fruit trees for a homestead orchard with some history in it. Grown on our West Virginia hilltop for Appalachian ground.",
  },
};
