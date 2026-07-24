import type { Product } from "@grove/odoo-client";

/**
 * At The Grove Nursery — category taxonomy (source of truth for the cat-bar).
 *
 * Each category has a stable URL slug (used in `?cat=<slug>`), a label for nav
 * and headings, a long description for the per-category landing, and a predicate
 * that matches a product against the category.
 *
 * ── Taxonomy: website (public) categories, not free-form tags ──────────
 *   The browse taxonomy is the nursery's **website categories** — Josh's
 *   five use-type buckets, displayed (GOL-773) as **Native · Fruit Tree ·
 *   Nut Tree · Fruit & Nut Shrubs · Vines**, in that order — maintained in
 *   Odoo as `product.public.category` (`public_categ_ids`). The grove_headless
 *   catalog API serializes them on every product as
 *   `categories: [{ id, name, slug }]` (grove-odoo-modules#31), and the
 *   odoo-client normalizer maps them onto `Product.categories`
 *   (`ProductCategory[]`, grove-sites#145). The `slug` is `slugify(name)`
 *   ("Fruit Trees" → "fruit-trees", "Natives & Ornamentals" →
 *   "natives-ornamentals"), so a category's `slug` here lines up 1:1 with
 *   the API's category slug and with the server-side `?cat=<slug>` filter.
 *   (grove-odoo-modules#33 repoints each seeded species' `public_categ_ids`
 *   from the growth-habit accounting bucket to these use-type buckets.)
 *
 *   ── `label` vs `slug` (GOL-773) ──
 *   `label` is the shopper-facing pill text and is ours to curate; `slug` is
 *   the URL + count key and MUST stay `slugify(<Odoo category name>)`. Josh's
 *   GOL-773 display names are set on `label` only — the Odoo category names
 *   (and therefore the slugs and `?cat=` URLs) are left untouched, so live
 *   filtering never breaks and no lockstep backend rename is required. To
 *   populate the two empty buckets, the backend just needs to *assign*
 *   products to the existing `berries` (Fruit & Nut Shrubs) and
 *   `natives-ornamentals` (Native) website categories — a reassignment, not a
 *   rename (tracked on GOL-757).
 *
 *   This replaces the previous mock plant-type tags (apple/pear/stone/…),
 *   which the real catalog never carried — every pill counted `· 0` because
 *   `product.tags` held guild tags (Native/Wildlife/…), not those slugs
 *   (GOL-658). Native and Fruit & Nut Shrubs have no assigned stock yet, so
 *   those two pills render as coming-soon nav items (no `· 0` count) until
 *   GOL-757 assigns products — that is the correct taxonomy, not the old
 *   all-zero bug.
 *
 * ── How filtering works ────────────────────────────────────────────────
 *   1. CategoryBar links go to `/shop?cat=<slug>`.
 *   2. /shop reads `searchParams.cat`, calls `filterByCategory(products, slug)`.
 *   3. `matchProduct(product)` returns `true` when the product carries a
 *      website category whose `slug` equals this category's slug — i.e.
 *      `product.categories.some(c => c.slug === category.slug)`.
 *   4. A product can belong to more than one website category, so it can
 *      match more than one pill. That's intentional.
 *
 *   Counts run client-side over the returned set (the catalog is small and
 *   the CategoryBar/facet counts must cross-reference the active zone/tag
 *   context anyway). The API also supports server-side `?cat=<slug>`
 *   filtering (the SEO twin of `?category_id`) if the catalog outgrows
 *   client-side counting.
 *
 * ── QA notes ──────────────────────────────────────────────────────────
 *   • Counts in the CategoryBar are derived from the live product list, not
 *     hardcoded. Clicking a category and seeing N products in the grid means
 *     the filter is honest.
 *   • Zero-result categories render an empty-state message rather than a
 *     blank grid — see /shop/page.tsx.
 *
 * ── When updating ─────────────────────────────────────────────────────
 *   • The nursery adds/renames website categories in Odoo. Mirror any
 *     visible change here so the nav label/description/order stay curated —
 *     but keep each `slug` equal to `slugify(<Odoo category name>)` or the
 *     count + `?cat` filter will silently miss.
 *   • Renaming a slug is a URL change — `/shop?cat=fruit-trees` is a
 *     contract. Avoid renaming unless coordinated with SEO + redirects.
 */

export interface NurseryCategory {
  /** Stable URL identifier — must equal `slugify(<Odoo website-category name>)`. */
  slug: string;
  /** Human-readable label for nav + headings. */
  label: string;
  /** Long-form description, shown on `/shop?cat=<slug>` heading band. */
  description: string;
  /** Predicate that decides if a product belongs to this category. */
  matchProduct: (product: Product) => boolean;
}

/** Predicate factory — a product matches when it carries a website category with this slug. */
function inCategory(slug: string): (product: Product) => boolean {
  return (product) => (product.categories ?? []).some((c) => c.slug === slug);
}

/**
 * The ordered list of categories shown in the nav.
 *
 * Order matters — this is the left-to-right order users see in the CategoryBar.
 * Josh's GOL-773 order: Native → Fruit Tree → Nut Tree → Fruit & Nut Shrubs →
 * Vines. Native and Fruit & Nut Shrubs carry no assigned stock yet and render
 * as coming-soon nav items (no count) until GOL-757 assigns products.
 */
export const NURSERY_CATEGORIES: NurseryCategory[] = [
  {
    slug: "natives-ornamentals",
    label: "Native",
    description:
      "Regional natives that anchor a resilient planting — pollinator forage, wildlife food, and roots that hold Appalachian ground. The supporting cast a food forest leans on. Potted stock is on the way; check back as the nursery grows.",
    matchProduct: inCategory("natives-ornamentals"),
  },
  {
    slug: "fruit-trees",
    label: "Fruit Tree",
    description:
      "The backbone of a homestead food forest — fig, pear, and persimmon grown for cold-climate orchards. Long-lived trees that anchor a planting for decades and start bearing in a few short years.",
    matchProduct: inCategory("fruit-trees"),
  },
  {
    slug: "nut-trees",
    label: "Nut Tree",
    description:
      "Long-game canopy trees grown for the nut harvest — walnut, chestnut, and hazel. Plant once and feed a household for generations. Potted stock is on the way; check back as the nursery grows.",
    matchProduct: inCategory("nut-trees"),
  },
  {
    slug: "berries",
    label: "Fruit & Nut Shrubs",
    description:
      "Fruit- and nut-bearing shrubs for the productive hedge and forest edge — aronia, serviceberry, and hazel, quick to crop and generous. Dense harvests from plants that shrug off a hard winter.",
    matchProduct: inCategory("berries"),
  },
  {
    slug: "fruiting-vines",
    label: "Vines",
    description:
      "Perennial vines for fences, arbors, and vertical space — hardy kiwi and kin. Big yields from a small footprint, trained up and out of the way.",
    matchProduct: inCategory("fruiting-vines"),
  },
];

/** Look up a category by URL slug. Returns null for unknown or empty slug. */
export function findCategory(slug: string | null | undefined): NurseryCategory | null {
  if (!slug) return null;
  return NURSERY_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** Filter a product list by category slug. Returns the full list when slug is null/unknown. */
export function filterByCategory(products: Product[], slug: string | null | undefined): Product[] {
  const category = findCategory(slug);
  if (!category) return products;
  return products.filter((p) => category.matchProduct(p));
}

/** Count how many products match a category. Used by the CategoryBar for live counts. */
export function countByCategory(products: Product[], slug: string): number {
  const category = findCategory(slug);
  if (!category) return products.length;
  return products.filter((p) => category.matchProduct(p)).length;
}
