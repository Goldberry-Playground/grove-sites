import { tenantConfig } from "../tenant.config";

/**
 * Site-level metadata constants shared by the root layout, the PDP metadata
 * builder, the sitemap and robots.txt (GOL-2878 Phase 1).
 *
 * Kept separate from `pdp-metadata.ts` so `app/layout.tsx` and `app/robots.ts`
 * do not have to import a product-detail module to learn the site origin.
 */

/** Absolute site origin. `metadataBase` in the root layout is built from this. */
export const SITE_URL = `https://${tenantConfig.domain}`;

/**
 * Site-level share card — a 1200×630 centre crop of the spring-orchard hero.
 * Facebook/X/LinkedIn all crop a 4:3 source unpredictably, so the card is
 * pre-cut at the 1.91:1 ratio they actually render rather than shipped as the
 * raw 1800×1350 hero.
 */
export const DEFAULT_OG_IMAGE = "/brand/og-default.jpg";
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_ALT =
  "Blossoming orchard rows at At The Grove Nursery in West Virginia";
