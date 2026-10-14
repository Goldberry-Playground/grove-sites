"use client";

import { ShopSubHeader as UiShopSubHeader } from "@grove/ui-kit";
import { GroveNextLink } from "../grove-adapters";

/**
 * Editorial shop sub-header. Sits beneath the global brand-header and above
 * every /shop route. GOL-139: the markup lives in @grove/ui-kit's
 * ShopSubHeader; this app wrapper owns the goldberry copy and injects the Next
 * Link.
 *
 * GOL-3315: the farm shop sells three Printify shirts, so the category pills
 * (Flour / Freeze-Dried / Jams / Mushrooms, from the deleted demo catalog) are
 * gone. The kit renders an empty nav for `categories={[]}`; the pills come back
 * with more products. Styling still comes from goldberry's local
 * `.shop-subheader` CSS (kept until GOL-137 resolves the shop `.product-card`
 * name collision before adopting the full @grove/ui-kit stylesheet).
 */
export function ShopSubHeader() {
  return (
    <GroveNextLink>
      <UiShopSubHeader
        eyebrow="The Goldberry Shop"
        title={
          <>
            Wear the grove <em>home with you</em>
          </>
        }
        lede="Shirts printed to order and shipped to you."
        categories={[]}
      />
    </GroveNextLink>
  );
}
