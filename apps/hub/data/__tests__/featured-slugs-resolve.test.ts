import { describe, expect, it } from "vitest";
import { marketplace } from "../marketplace";
import { seededCatalogSnapshot } from "../qa-catalog-snapshot";

/**
 * The GOL-400 / GOL-439 guard: a featured ref whose product does not exist in
 * the seeded catalog is silently dropped by fetchFeaturedProducts and renders
 * an empty featured row. This test fails the build if any featured slug is
 * absent from the seeded-catalog snapshot (i.e. would return count=0 from the
 * seeded Odoo), so the slug-gap can't silently re-appear.
 *
 * When you retarget featured[] to a new slug, regenerate the snapshot from a
 * live seeded Odoo — see qa-catalog-snapshot.ts. Do NOT hand-add the slug here
 * to make the test pass; that defeats the guard.
 */
describe("featured slugs resolve against the seeded QA catalog", () => {
  it("has a non-empty featured row (an empty row is the GOL-400 regression)", () => {
    expect(marketplace.featured.length).toBeGreaterThan(0);
  });

  it("every featured slug exists in the seeded-catalog snapshot", () => {
    const unresolved = marketplace.featured.filter((slot) => {
      const seeded = seededCatalogSnapshot[slot.ref.vendor] ?? [];
      return !seeded.includes(slot.ref.productSlug);
    });

    // Rich failure message so a broken feature is diagnosable from CI logs.
    const detail = unresolved
      .map((s) => `${s.ref.vendor}/${s.ref.productSlug}`)
      .join(", ");
    expect(
      unresolved,
      `Featured slug(s) not present in the seeded QA catalog (would render empty): ${detail}. ` +
        `Regenerate the snapshot from a seeded Odoo or retarget the slug — see qa-catalog-snapshot.ts.`,
    ).toEqual([]);
  });

  it("snapshot only lists vendors that exist in the marketplace", () => {
    const vendorSlugs = new Set(marketplace.vendors.map((v) => v.slug));
    for (const vendor of Object.keys(seededCatalogSnapshot)) {
      expect(vendorSlugs.has(vendor), `snapshot vendor "${vendor}" is unknown`).toBe(true);
    }
  });
});
