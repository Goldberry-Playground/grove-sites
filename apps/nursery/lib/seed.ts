import type { SeedSeason } from "@grove/odoo-client";

/**
 * True when this product is a seed-nut pre-order (GOL-3258): it carries a seed
 * season, or any variant is on the `seed` shipping tier. The product page then
 * renders the seed buy box instead of the tree one. Kept out of the client
 * component so the server page can call it.
 */
export function isSeedProduct(input: {
  seedSeason?: SeedSeason | null;
  variants: ReadonlyArray<{ shippingTier?: string | null }>;
}): boolean {
  return input.seedSeason != null || input.variants.some((v) => v.shippingTier === "seed");
}
