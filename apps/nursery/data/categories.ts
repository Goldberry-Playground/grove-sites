import type { Product } from "@grove/odoo-client";

/**
 * At The Grove Nursery — category taxonomy (source of truth).
 *
 * Each category has a stable URL slug (used in `?cat=<slug>`), a label for nav
 * and headings, a long description for the per-category landing, a predicate
 * that matches a product against the category, and an `odooTagIds` array for
 * future Odoo integration.
 *
 * ── How filtering works today (mockProducts) ───────────────────────────
 *   1. mockProducts in `apps/nursery/data/mock-products.ts` carries a
 *      `tags: string[]` array per product, e.g. `["apple", "bare-root"]`.
 *   2. CategoryBar links go to `/shop?cat=<slug>`.
 *   3. /shop reads `searchParams.cat`, calls `filterByCategory(products, slug)`.
 *   4. `matchProduct(product)` returns `true` if `product.tags` includes the
 *      category's slug (the most common pattern) or a custom rule.
 *
 * ── How filtering will work with Odoo ─────────────────────────────────
 *   1. Odoo's `product.template.product_tag_ids` (many2many) carries the
 *      tags. The grove_headless API serializes them as a `tags` array on
 *      each product (see TODO in `packages/odoo-client/src/normalizers.ts`).
 *   2. The `odooTagIds` array in each category below maps the URL slug to the
 *      actual Odoo tag IDs (one slug can map to multiple tag IDs — e.g.
 *      "stone" might cover "Plum" + "Cherry" + "Peach" tags in Odoo).
 *   3. Once `odooTagIds` is populated, `matchProduct` can be reimplemented as
 *      `(p) => p.tags.some(t => category.odooTagIds.includes(...))` OR the
 *      Odoo API can be passed `tag_ids` query params to filter server-side
 *      (preferred for large catalogs).
 *
 * ── QA notes ──────────────────────────────────────────────────────────
 *   • Counts in the CategoryBar are derived from the live product list, not
 *     hardcoded. Clicking a category and seeing N products in the grid means
 *     the filter is honest.
 *   • A product can match multiple categories (e.g. a bare-root apple matches
 *     both `apple` AND `bare-root`). That's intentional.
 *   • Zero-result categories render an empty-state message rather than a
 *     blank grid — see /shop/page.tsx.
 *
 * ── When updating ─────────────────────────────────────────────────────
 *   • Adding a new category: append to NURSERY_CATEGORIES, then add the
 *     corresponding tag to relevant mockProducts. Update the homepage
 *     CategoryBar usage if a new visible nav item is needed.
 *   • Renaming a slug: this is a URL change — `/shop?cat=apple` is a
 *     contract. Avoid renaming unless coordinated with SEO + redirects.
 */

export interface NurseryCategory {
  /** Stable URL identifier — used in `?cat=<slug>`. Don't rename without redirects. */
  slug: string;
  /** Human-readable label for nav + headings. */
  label: string;
  /** Long-form description, shown on `/shop?cat=<slug>` heading band. */
  description: string;
  /** Predicate that decides if a product belongs to this category. */
  matchProduct: (product: Product) => boolean;
  /**
   * Future Odoo tag IDs that map to this slug. Empty until grove_headless
   * exposes `product.template.product_tag_ids` in the list/detail responses.
   * Populate by running an Odoo XML-RPC query against product.tag and
   * recording the integer IDs here.
   */
  odooTagIds: number[];
}

/**
 * The ordered list of categories shown in the nav.
 *
 * Order matters — this is the left-to-right order users see in the CategoryBar.
 * Convention: plant-type categories first (apple, pear, stone, berries, nuts),
 * then propagation/sale-state categories (rootstock, bare-root, cold-strat).
 */
export const NURSERY_CATEGORIES: NurseryCategory[] = [
  {
    slug: "apple",
    label: "Apple",
    description:
      "Cold-hardy apples for orchard and homestead. M.111 semi-dwarf and standard rootstock available; varieties tested in USDA 3–7.",
    matchProduct: (p) => (p.tags ?? []).includes("apple"),
    odooTagIds: [],
  },
  {
    slug: "pear",
    label: "Pear",
    description:
      "Cold-hardy pears, OHxF rootstock. Most need a pollination partner; pair varieties from adjacent rows when possible.",
    matchProduct: (p) => (p.tags ?? []).includes("pear"),
    odooTagIds: [],
  },
  {
    slug: "stone",
    label: "Stone Fruit",
    description:
      "Cherries, plums, and peaches selected for cold-climate orchards. Tart and dessert varieties; sweet cherries thrive in USDA 5–7.",
    matchProduct: (p) => (p.tags ?? []).includes("stone"),
    odooTagIds: [],
  },
  {
    slug: "berries",
    label: "Berries",
    description:
      "Grapes, currants, gooseberries, and bramble fruit. Most ship in 1-gallon pots; a few canes are bare-root in spring.",
    matchProduct: (p) => (p.tags ?? []).includes("berries"),
    odooTagIds: [],
  },
  {
    slug: "nuts",
    label: "Nuts & Hardwood",
    description:
      "Black walnut, hazelnut, hickory. Long-horizon plantings — 7-15 years to first crop. The trees you plant for the next generation.",
    matchProduct: (p) => (p.tags ?? []).includes("nuts"),
    odooTagIds: [],
  },
  {
    slug: "rootstock",
    label: "Rootstock",
    description:
      "Grafting rootstock — buy plain to graft your own scion. M.111, M.106, OHxF 87, Mazzard, and Bailey selections.",
    matchProduct: (p) => (p.tags ?? []).includes("rootstock"),
    odooTagIds: [],
  },
  {
    slug: "bare-root",
    label: "Bare-Root Specials",
    description:
      "Bare-root trees, shipped during the winter dormancy window (December – March). Lighter, cheaper to ship, and they establish faster than potted stock.",
    matchProduct: (p) => (p.tags ?? []).includes("bare-root"),
    odooTagIds: [],
  },
  {
    slug: "cold-strat",
    label: "Cold-Stratified",
    description:
      "Seeds and nuts pre-treated for cold stratification — sow immediately on receipt. Walnut, hickory, pawpaw, and persimmon seed.",
    matchProduct: (p) => (p.tags ?? []).includes("cold-strat"),
    odooTagIds: [],
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
