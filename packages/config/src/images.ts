/**
 * Shared next/image settings for every Grove storefront. Apps spread this into
 * `images` and add only their own `remotePatterns`, so format, width and cache
 * choices can't drift between sites. `scripts/image-budget.mjs` enforces that.
 *
 * Rationale: docs/storefront-delivery-standard.md.
 */
export const groveImageDefaults = {
  // WebP only: AVIF took ~2s to encode from cold against ~0.5s for WebP.
  formats: ["image/webp"],
  // No photo source exceeds Odoo's image_1920, so wider rungs add only cache slots.
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  // 75 is the next/image default; 82 is the product-photo quality (GOL-818).
  qualities: [75, 82],
  // Optimized variants are immutable per asset revision: 31 days.
  minimumCacheTTL: 2678400,
} satisfies {
  formats: Array<"image/webp" | "image/avif">;
  deviceSizes: number[];
  qualities: number[];
  minimumCacheTTL: number;
};
