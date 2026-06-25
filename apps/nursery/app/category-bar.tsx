import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { odoo } from "../lib/clients";
import { mockProducts } from "../data/mock-products";
import { NURSERY_CATEGORIES, countByCategory } from "../data/categories";

/**
 * Cross-page category nav for At The Grove Nursery.
 *
 * Renders the horizontal pill row at the top of the homepage and /shop:
 *   All · Apple · Pear · Stone Fruit · Berries · Nuts · Rootstock · Bare-Root · Cold-Strat · Wholesale
 *
 * Each pill shows a live count derived from the actual product list (Odoo if
 * reachable, mockProducts otherwise). Clicking a pill links to `/shop?cat=<slug>`.
 *
 * The `activeSlug` prop controls which pill renders in the highlighted state.
 * Pass it from the consuming page (the /shop page reads it from searchParams;
 * the homepage doesn't have an active category and passes null/undefined).
 *
 * This is an async Server Component — it fetches its own product list for
 * count computation. The fetch uses the same Odoo-first-fallback-to-mock
 * pattern as the shop page, so the counts are guaranteed honest under all
 * runtime conditions (Odoo up, Odoo down, Odoo empty).
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

  return (
    <nav className="cat-bar" aria-label="Browse the catalog by category">
      <Link
        href="/shop"
        className={!activeSlug ? "is-active" : ""}
        aria-current={!activeSlug ? "page" : undefined}
      >
        All Catalog · {totalCount}
      </Link>
      {NURSERY_CATEGORIES.map((category) => {
        const count = countByCategory(products, category.slug);
        const isActive = activeSlug === category.slug;
        return (
          <Link
            key={category.slug}
            href={`/shop?cat=${category.slug}`}
            className={isActive ? "is-active" : ""}
            aria-current={isActive ? "page" : undefined}
          >
            {category.label} · {count}
          </Link>
        );
      })}
      <Link href="/wholesale">Wholesale</Link>
    </nav>
  );
}
