import type { Product } from "@grove/odoo-client";
import { CategoryBar as UiCategoryBar, type CategoryBarItem } from "@grove/ui-kit";
import { odoo } from "../lib/clients";
import { mockProducts } from "../data/mock-products";
import { NURSERY_CATEGORIES, countByCategory } from "../data/categories";

/**
 * Async server component: fetches live product counts (Odoo first, mock
 * fallback), maps them onto CategoryBarItem[], and delegates rendering to
 * @grove/ui-kit CategoryBar. The fetch and count logic are unchanged from
 * the local version — only the render is lifted. GOL-139.
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
  const totalCount = products.length;

  const activeHref = activeSlug ? `/shop?cat=${activeSlug}` : "/shop";

  const items: CategoryBarItem[] = NURSERY_CATEGORIES.map((category) => ({
    slug: category.slug,
    label: category.label,
    href: `/shop?cat=${category.slug}`,
    count: countByCategory(products, category.slug),
  }));

  return (
    <UiCategoryBar
      allItem={{ slug: "all", label: "All Catalog", href: "/shop", count: totalCount }}
      items={items}
      trailing={{ label: "Wholesale", href: "/wholesale" }}
      activeHref={activeHref}
    />
  );
}
