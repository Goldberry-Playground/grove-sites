/**
 * Brand asset taxonomy (ADR-009). `@grove/brand` is the canonical home for the
 * brand + asset-class vocabulary; the AgenticOS `#assets` caption parser
 * (`packages/discord-plugin/src/assets/caption.ts` — `KNOWN_BRANDS`,
 * `KNOWN_CLASSES`, `LOGO_CLASS`) mirrors these values so a caption can be routed
 * to the right lane. The two lists MUST stay in sync; `taxonomy.test.ts` pins the
 * expected values so a change here (or a drift there) fails loudly.
 *
 * ADR-009 tiers relevant to the `#assets` lane:
 *   - `logo`  → Tier 4: opens a typed `@grove/brand` PR (see `asset-brand.ts`)
 *   - rest    → Tier 3: replies with a CDN URL (grove-sites `upload-asset.ts`)
 */

/** Brand namespaces. Mirrors the grove-sites tenants (hub = "gather"). */
export const KNOWN_BRANDS = ["goldberry", "ggg", "nursery", "gather"] as const;
export type Brand = (typeof KNOWN_BRANDS)[number];

/**
 * Asset classes handled by the `#assets` lane (Tier 3 brand statics + Tier 4
 * logos). Product photos (Tier 2 → Odoo) and editorial (Tier 1 → Ghost) have
 * their own lanes and are deliberately excluded.
 */
export const KNOWN_CLASSES = [
  "hero",
  "about",
  "founders",
  "banner",
  "gallery",
  "background",
  "video",
  "logo",
] as const;
export type AssetClass = (typeof KNOWN_CLASSES)[number];

/** The one class that routes to the Tier 4 `@grove/brand` PR path. */
export const LOGO_CLASS: AssetClass = "logo";

/** Type guard: is `value` a known brand namespace? */
export function isKnownBrand(value: string): value is Brand {
  return (KNOWN_BRANDS as readonly string[]).includes(value);
}

/** Type guard: is `value` a known asset class? */
export function isKnownClass(value: string): value is AssetClass {
  return (KNOWN_CLASSES as readonly string[]).includes(value);
}

/** Whether an asset class routes to the Tier 4 `@grove/brand` PR path. */
export function isLogoClass(assetClass: AssetClass): boolean {
  return assetClass === LOGO_CLASS;
}
