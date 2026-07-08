/**
 * @grove/brand — canonical brand-asset manifest (ADR-009 Tier 4).
 *
 * Rules (odoocker/docs/ADR/ADR-009, vault Software/Grove Asset Storage):
 * - SVG logos are small, stable, structural → they live in git, in this
 *   package under `assets/`, and are also copied to each consuming app's
 *   `public/brand/` for zero-config serving.
 * - Raster renders (PNG, responsive sizes) live on DO Spaces + CDN and
 *   resolve against NEXT_PUBLIC_ASSET_BASE. Never hardcode a CDN host.
 * - A missing/renamed asset should be a type error, not a 404 — always go
 *   through the typed getters below.
 *
 * Upload/refresh renders with `scripts/upload-brand-assets.sh`.
 */

export type BrandId = "goldberry" | "ggg" | "nursery" | "hub";

/** CDN base for binary renders. Empty string → app-local `/brand/...` fallback. */
export function assetBase(): string {
  return (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ */
/* Gather at the Grove (hub) — logo system, first draft 2026-07-05.    */
/* Mark: unity circle, three trees (fir/broadleaf/cypress = the three  */
/* storefronts), gold sun. Wordmark: Fraunces, warm bark #5C3A1F.      */
/* ------------------------------------------------------------------ */

export const GATHER_LOGO_VARIANTS = [
  "primary",
  "horizontal",
  "logomark",
  "primary-reversed",
  "horizontal-reversed",
  "logomark-reversed",
] as const;

export type GatherLogoVariant = (typeof GATHER_LOGO_VARIANTS)[number];

/** File stem for a variant, e.g. "gather-logo-primary" | "gather-logomark". */
export function gatherLogoName(variant: GatherLogoVariant): string {
  return variant.startsWith("logomark")
    ? `gather-${variant}`
    : `gather-logo-${variant}`;
}

/**
 * SVG path for the hub logo. Served app-locally from `public/brand/gather/`
 * (the SVGs are in git), or from the CDN when NEXT_PUBLIC_ASSET_BASE is set.
 */
export function gatherLogoSvg(variant: GatherLogoVariant): string {
  return `${assetBase()}/brand/gather/${gatherLogoName(variant)}.svg`;
}

/** 1600px PNG render on the DO Spaces CDN (requires NEXT_PUBLIC_ASSET_BASE). */
export function gatherLogoPng(variant: GatherLogoVariant): string {
  return `${assetBase()}/brand/gather/${gatherLogoName(variant)}.png`;
}

/**
 * Variant guidance:
 * - `primary` (stacked) — hero/landing, social avatars at ≥160px.
 * - `horizontal` — site header / nav.
 * - `logomark` — favicons, small squares, watermark.
 * - `*-reversed` — parchment-on-dark for deep-earth (#2A2318) surfaces;
 *   never place the dark logo on a dark background (brand-guide rule).
 */
export const gatherLogos = Object.fromEntries(
  GATHER_LOGO_VARIANTS.map((v) => [v, { svg: gatherLogoSvg(v), png: gatherLogoPng(v) }]),
) as Record<GatherLogoVariant, { svg: string; png: string }>;
