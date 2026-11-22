import type { Product } from "@grove/odoo-client";
import { buyStateFor } from "./buy-state";
import { resolvePdpCopy, resolvePdpImage } from "./pdp-metadata";
import { isSeedProduct } from "./seed";
import { SITE_URL } from "./site-metadata";

/**
 * schema.org `Product` + `offers` for the nursery PDP (GOL-4086, spec from
 * GOL-2888), so price and availability can show in search results.
 *
 * Built per request from the same product the page renders. Stock state lives
 * here and NOT in the meta description: Google caches a description for weeks,
 * and product 132 flipped `in_stock` inside one day during the GOL-2875 audit.
 *
 * Deliberately absent:
 * - `aggregateRating` / `review`: the site has no real reviews.
 * - `shippingDetails`: rates are quoted per destination at checkout, and a
 *   pickup-only product must not imply shipping at all.
 */

const SCHEMA = "https://schema.org";

export type ProductAvailability = "InStock" | "InStoreOnly" | "PreOrder" | "OutOfStock";

type OfferCandidate = Pick<
  Product["variants"][number],
  "price" | "available" | "qtyAvailable" | "shippingTier" | "format"
>;

/**
 * Availability and the price it applies to.
 *
 * Each variant goes through `buyStateFor`, the same decision the buy box
 * renders, so the block cannot say "in stock" next to a "Sold out" button:
 * - any variant on hand: `InStock`, or `InStoreOnly` for a farm-pickup-only
 *   product (`grove_pickup_only`), which never ships;
 * - none on hand but a Bareroot reservation is open: `PreOrder`;
 * - otherwise (sold out, cap reached, or `sale_ok` false): `OutOfStock`.
 *
 * The price is the lowest among the variants in that state, so the advertised
 * price is always one a shopper can actually pay. A seed product follows its
 * season switch instead: seed packs are only ever a pre-order.
 */
export function resolveOffer(
  product: Pick<
    Product,
    "price" | "available" | "variants" | "saleOk" | "preorderCapReached" | "pickupOnly" | "seedSeason"
  >,
): { availability: ProductAvailability; price: number } {
  const candidates: OfferCandidate[] =
    product.variants.length > 0
      ? product.variants
      : [{ price: product.price, available: product.available }];
  const lowest = (list: OfferCandidate[]) => Math.min(...list.map((c) => c.price));

  if (isSeedProduct(product)) {
    const open = product.saleOk !== false && product.seedSeason?.open === true;
    return { availability: open ? "PreOrder" : "OutOfStock", price: lowest(candidates) };
  }

  const modeOf = (c: OfferCandidate) =>
    buyStateFor({
      available: c.available,
      qtyAvailable: c.qtyAvailable ?? null,
      shippingTier: c.shippingTier ?? null,
      format: c.format ?? null,
      saleOk: product.saleOk,
      capReached: product.preorderCapReached,
      pickupOnly: product.pickupOnly,
    }).mode;

  const inStock = candidates.filter((c) => modeOf(c) === "in-stock");
  if (inStock.length > 0) {
    return { availability: product.pickupOnly ? "InStoreOnly" : "InStock", price: lowest(inStock) };
  }
  const reservable = candidates.filter((c) => modeOf(c) === "reservable");
  if (reservable.length > 0) {
    return { availability: "PreOrder", price: lowest(reservable) };
  }
  return { availability: "OutOfStock", price: lowest(candidates) };
}

export interface ProductJsonLdInput {
  product: Product;
  /** Site-relative canonical path, the slug form (`/shop/<slug>`). */
  canonicalPath: string;
  /** Public Odoo origin, for turning a relative `/web/image/...` path absolute. */
  odooBase: string;
}

/**
 * Build the `Product` block, or `null` when the product has no usable price
 * (a $0 offer in search results would be worse than no block).
 *
 * `description` and `image` come from the same resolvers as the meta
 * description and `og:image`, so the two never disagree. `name` is the product
 * name the page shows in its `<h1>`, not the SEO `<title>` ("Jujube Trees for
 * Sale"), because structured data has to match the visible page.
 */
export function buildProductJsonLd({ product, canonicalPath, odooBase }: ProductJsonLdInput) {
  const { availability, price } = resolveOffer(product);
  if (!Number.isFinite(price) || price <= 0) return null;

  const { description } = resolvePdpCopy(product);
  const image = resolvePdpImage(product, odooBase);
  const url = `${SITE_URL}${canonicalPath}`;

  return {
    "@context": SCHEMA,
    "@type": "Product",
    name: product.name,
    description,
    // Resolved against the site so a site-relative photo is still absolute.
    ...(image ? { image: new URL(image, SITE_URL).toString() } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    url,
    offers: {
      "@type": "Offer",
      url,
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: `${SCHEMA}/${availability}`,
      // Farm pickup only (GOL-2587): say so, and never describe shipping.
      ...(product.pickupOnly ? { availableDeliveryMethod: `${SCHEMA}/OnSitePickup` } : {}),
    },
  };
}
