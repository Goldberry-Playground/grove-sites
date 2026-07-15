import { describe, expect, it } from "vitest";
import { marketplace, findVendor } from "./marketplace";

/**
 * Invariants for the editorial overlay (GOL-400).
 *
 * These catch the class of mistake that shipped the empty featured row: a
 * `featured[]` ref that no longer points at anything renderable. What is
 * checkable *offline* is the vendor half of the ref plus the coming-soon rule.
 *
 * The other half — does `productSlug` exist in that vendor's Odoo — needs a
 * live seeded catalog and is deliberately NOT asserted here; a unit test must
 * not depend on a droplet being up. `fetchFeaturedProducts` warns server-side
 * when a slug fails to resolve, and GOL-401 tracks the CI check against the
 * seeded catalog.
 */
describe("marketplace editorial overlay", () => {
  it("every featured ref names a vendor that exists in the overlay", () => {
    for (const slot of marketplace.featured) {
      expect(
        findVendor(slot.ref.vendor),
        `featured ref "${slot.ref.productSlug}" names unknown vendor "${slot.ref.vendor}"`,
      ).not.toBeNull();
    }
  });

  it("never features a pre-launch (comingSoon) vendor", () => {
    // A comingSoon vendor is never fetched, so a featured ref pointing at one
    // can only ever render as a hole.
    for (const slot of marketplace.featured) {
      const vendor = findVendor(slot.ref.vendor);
      expect(
        vendor?.comingSoon,
        `featured ref "${slot.ref.productSlug}" points at pre-launch vendor "${slot.ref.vendor}"`,
      ).toBeUndefined();
    }
  });

  it("has unique vendor slugs", () => {
    const slugs = marketplace.vendors.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps editorial notes short enough to read as a pull-quote", () => {
    // The card treatment assumes a pull-quote, not a paragraph.
    for (const slot of marketplace.featured) {
      if (!slot.editorialNote) continue;
      expect(
        slot.editorialNote.length,
        `editorial note for "${slot.ref.productSlug}" exceeds 120 chars`,
      ).toBeLessThanOrEqual(120);
    }
  });

  it("every journal link names a vendor that exists in the overlay", () => {
    for (const link of marketplace.journalLinks) {
      expect(
        findVendor(link.ref.vendor),
        `journal link on post "${link.postSlug}" names unknown vendor "${link.ref.vendor}"`,
      ).not.toBeNull();
    }
  });
});
