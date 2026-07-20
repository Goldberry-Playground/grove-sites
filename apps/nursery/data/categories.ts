import type { Product } from "@grove/odoo-client";

/**
 * At The Grove Nursery — category taxonomy (source of truth for the cat-bar).
 *
 * Each category has a stable URL slug (used in `?cat=<slug>`), a label for nav
 * and headings, a long description for the per-category landing, and a predicate
 * that matches a product against the category.
 *
 * ── Taxonomy: website (public) categories, not free-form tags ──────────
 *   The browse taxonomy is the nursery's **website categories** — Trees,
 *   Shrubs, Vines — maintained in Odoo as `product.public.category`. The
 *   grove_headless catalog API serializes them on every product as
 *   `categories: [{ id, name, slug }]` (grove-odoo-modules#31), and the
 *   odoo-client normalizer maps them onto `Product.categories`
 *   (`ProductCategory[]`, grove-sites#145). The `slug` is `slugify(name)`
 *   ("Trees" → "trees", "Stone Fruit" → "stone-fruit"), so a category's
 *   `slug` here lines up 1:1 with the API's category slug and with the
 *   server-side `?cat=<slug>` filter.
 *
 *   This replaces the previous mock plant-type tags (apple/pear/stone/…),
 *   which the real catalog never carried — every pill counted `· 0` because
 *   `product.tags` held guild tags (Native/Wildlife/…), not those slugs
 *   (GOL-658).
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
 *   • Renaming a slug is a URL change — `/shop?cat=trees` is a contract.
 *     Avoid renaming unless coordinated with SEO + redirects.
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
 * Trees → Shrubs → Vines mirrors the food-forest structure (canopy/understory,
 * then the productive edge, then the vertical layer) and the seeded website
 * categories on QA.
 */
export const NURSERY_CATEGORIES: NurseryCategory[] = [
  {
    slug: "trees",
    label: "Trees",
    description:
      "The canopy and understory of a food forest — fruit and nut trees that anchor a planting for decades. Pears, persimmons, serviceberry, and more, grown for cold-climate homesteads.",
    matchProduct: inCategory("trees"),
  },
  {
    slug: "shrubs",
    label: "Shrubs",
    description:
      "Berry-bearing shrubs for the productive hedge and forest edge — aronia, fig, and kin. Quick to fruit, generous croppers, and at home in a mixed guild.",
    matchProduct: inCategory("shrubs"),
  },
  {
    slug: "vines",
    label: "Vines",
    description:
      "Perennial fruiting vines for fences, arbors, and vertical space — hardy kiwi and friends. Big yields from a small footprint.",
    matchProduct: inCategory("vines"),
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
