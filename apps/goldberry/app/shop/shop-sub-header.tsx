"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ShopSubHeader as UiShopSubHeader, type ShopCategory } from "@grove/ui-kit";
import { SHOP_CATEGORIES } from "../../data/mock-products";

/**
 * Thin client wrapper: resolves route + query to activeHref, maps
 * SHOP_CATEGORIES to ShopCategory[], and delegates to @grove/ui-kit
 * ShopSubHeader. Goldberry editorial copy (eyebrow/title/lede) is
 * brand-local and passed as props. GOL-139.
 */
export function ShopSubHeader() {
  const pathname = usePathname() ?? "/shop";
  const searchParams = useSearchParams();
  const activeCat = (searchParams?.get("cat") ?? "all").toLowerCase();
  const onDetail = /^\/shop\/[^/]+$/.test(pathname);

  const activeHref = onDetail
    ? undefined
    : activeCat === "all"
      ? "/shop"
      : `/shop?cat=${activeCat}`;

  const categories: ShopCategory[] = SHOP_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    href: cat.id === "all" ? "/shop" : `/shop?cat=${cat.id}`,
  }));

  return (
    <UiShopSubHeader
      eyebrow="The Goldberry Shop"
      title={<>Small-batch goods <em>from the hillside</em></>}
      lede="Chestnut flour, freeze-dried Appalachian fruit, jams, and inoculation kits — rendered from what the grove grew this season."
      categories={categories}
      activeHref={activeHref}
    />
  );
}
