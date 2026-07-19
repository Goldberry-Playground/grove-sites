/**
 * Seeded-catalog snapshot — the guard behind featured[].
 *
 * Maps each vendor slug to the set of grove_slug values that exist in the
 * seeded QA/preview Odoo snapshot. `featured-slugs-resolve.test.ts` asserts
 * that every ref in `marketplace.featured` is present here, so a featured slug
 * that resolves to count=0 in the seeded Odoo fails CI instead of silently
 * rendering an empty featured row (the GOL-400 failure mode).
 *
 * PROVENANCE — this file is generated, not hand-authored inventory. Regenerate
 * it from a live seeded Odoo (preview env from GOL-144, or grove-qa-l3-odoo):
 *
 *     GROVE_ODOO_URL=<seeded-odoo-url> node scripts/check-featured-slugs.mjs --write
 *
 * That script queries /grove/api/v1/products per vendor tenant and rewrites the
 * SNAPSHOT below. `--verify` (default) instead fails non-zero if any featured
 * slug returns count=0 live — wire that into the preview pipeline for a
 * live gate on top of this every-PR check.
 *
 * Last updated: 2026-07-19 (GOL-440). Added nursery `chestnut` = id 151,
 * At The Grove Nursery (company 9) — confirmed count=1 against grove-qa-l3-odoo
 * (`scripts/check-featured-slugs.mjs --verify`), now featured alongside the
 * sticker. Nursery `sticker` = id 169 (GOL-431/Terra).
 *
 * This map deliberately tracks the SANITIZED PREVIEW env (goldberry/ggg empty
 * until GOL-104 seeds them), NOT the live QA droplet — a full regen against
 * grove-qa-l3-odoo would import goldberry products (4, incl. both old sticker
 * slugs) that the preview env lacks, weakening the guard. Only slugs verified
 * to render in the preview env belong here.
 */

/** vendor slug → grove_slug values present in the seeded QA/preview catalog. */
export const seededCatalogSnapshot: Record<string, string[]> = {
  goldberry: [],
  nursery: ["sticker", "chestnut"],
  ggg: [],
};
