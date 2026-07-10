"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ShopSubHeader as UiShopSubHeader } from "@grove/ui-kit";
import { SHOP_CATEGORIES } from "../../data/mock-products";
import { GroveNextLink } from "../grove-adapters";

/**
 * Editorial shop sub-header. Sits beneath the global brand-header and above
 * every /shop route. GOL-139: the markup + pill logic now live in
 * @grove/ui-kit's ShopSubHeader; this app wrapper owns the goldberry copy,
 * derives active state from the route, and injects the Next Link.
 *
 * Categories drive a `?cat=<slug>` query on the list page; on a detail page no
 * pill is active. Styling still comes from goldberry's local `.shop-subheader`
 * CSS (kept until GOL-137 resolves the shop `.product-card` name collision
 * before adopting the full @grove/ui-kit stylesheet).
 */
export function ShopSubHeader() {
  const pathname = usePathname() ?? "/shop";
  const searchParams = useSearchParams();
  const activeCat = (searchParams?.get("cat") ?? "all").toLowerCase();
  const onDetail = /^\/shop\/[^/]+$/.test(pathname);

  const categories = SHOP_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    href: cat.id === "all" ? "/shop" : `/shop?cat=${cat.id}`,
  }));

  // No pill is active on a product detail page.
  const activeHref = onDetail
    ? undefined
    : activeCat === "all"
      ? "/shop"
      : `/shop?cat=${activeCat}`;

  return (
    <GroveNextLink>
      <UiShopSubHeader
        eyebrow="The Goldberry Shop"
        title={
          <>
            Small-batch goods <em>from the hillside</em>
          </>
        }
        lede="Chestnut flour, freeze-dried Appalachian fruit, jams, and inoculation kits — rendered from what the grove grew this season."
        categories={categories}
        activeHref={activeHref}
      />
    </GroveNextLink>
  );
}
