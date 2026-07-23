import type { Product } from "@grove/odoo-client";
import { odoo } from "../lib/clients";
import { mockProducts } from "../data/mock-products";
import { NURSERY_CATEGORIES, countByCategory } from "../data/categories";
import { CategoryBarView } from "./category-bar-view";

/**
 * Cross-page category nav for At The Grove Nursery.
 *
 * Renders the horizontal pill row at the top of the homepage and /shop, each
 * pill showing a live count derived from the actual product list (Odoo if
 * reachable, mockProducts otherwise). Clicking a pill links to `/shop?cat=<slug>`.
 *
 * GOL-139: presentation lives in @grove/ui-kit's CategoryBar; this async Server
 * Component still owns the Odoo-first-fallback-to-mock fetch + count math, then
 * hands typed items to the ui-kit-backed client view.
 *
 * The `activeSlug` prop controls which pill highlights. The /shop page reads it
 * from searchParams; the homepage has no active category and passes null.
 */

async function fetchProductsForCounts(): Promise<Product[]> {
  try {
    const result = await odoo.products.list({ limit: 200 });
    if (result.products.length > 0) return result.products;
  } catch {
    // Odoo unreachable — fall through to mock data below.
  }
  return mockProducts;
}

interface CategoryBarProps {
  activeSlug?: string | null;
  /**
   * Product set the pill counts are derived from. When provided (e.g. /shop with
   * active zone/layer/sun/tag facets), the counts reflect those filters so the
   * bar stays honest against the grid. When omitted (the homepage, which has no
   * facets), CategoryBar fetches the full catalog itself. GOL-658: Josh asked the
   * counts to "work off filters" — without this the bar always counted the full
   * unfiltered catalog while the grid filtered server-side.
   */
  products?: Product[] | null;
}

export async function CategoryBar({ activeSlug, products: provided }: CategoryBarProps) {
  const products = provided ?? (await fetchProductsForCounts());

  const allItem = {
    slug: "all",
    label: "All Catalog",
    href: "/shop",
    count: products.length,
  };

  // Show all five canonical buckets (GOL-773 — Josh enumerated the full browse
  // taxonomy: Native · Fruit Tree · Nut Tree · Fruit & Nut Shrubs · Vines).
  // Buckets with no assigned stock yet (Native, Fruit & Nut Shrubs until GOL-757
  // assigns products) drop their count so the pill reads as a clean coming-soon
  // nav item, not a `· 0` dead end (the earlier GOL-682 #5 concern) — clicking
  // one lands on a "stock is on the way" empty state rather than a blank grid.
  const items = NURSERY_CATEGORIES.map((category) => {
    const count = countByCategory(products, category.slug);
    return {
      slug: category.slug,
      label: category.label,
      href: `/shop?cat=${category.slug}`,
      count: count > 0 ? count : undefined,
    };
  });

  // A category is active when its href matches; the "All" pill is active when
  // no category is selected (its href is "/shop").
  const activeHref = activeSlug ? `/shop?cat=${activeSlug}` : "/shop";

  return (
    <CategoryBarView
      allItem={allItem}
      items={items}
      // Wholesale intentionally off the cat bar for QA (Josh 2026-07-23); /wholesale page stays routable.
      activeHref={activeHref}
    />
  );
}
