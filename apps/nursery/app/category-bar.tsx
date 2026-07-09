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
}

export async function CategoryBar({ activeSlug }: CategoryBarProps) {
  const products = await fetchProductsForCounts();

  const allItem = {
    slug: "all",
    label: "All Catalog",
    href: "/shop",
    count: products.length,
  };

  const items = NURSERY_CATEGORIES.map((category) => ({
    slug: category.slug,
    label: category.label,
    href: `/shop?cat=${category.slug}`,
    count: countByCategory(products, category.slug),
  }));

  // A category is active when its href matches; the "All" pill is active when
  // no category is selected (its href is "/shop").
  const activeHref = activeSlug ? `/shop?cat=${activeSlug}` : "/shop";

  return (
    <CategoryBarView
      allItem={allItem}
      items={items}
      trailing={{ label: "Wholesale", href: "/wholesale" }}
      activeHref={activeHref}
    />
  );
}
