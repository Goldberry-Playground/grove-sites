import { describe, expect, it } from "vitest";
import { marketplace, findVendor, buildCheckoutUrl } from "../marketplace";

describe("marketplace.ts integrity", () => {
  it("every featured slot references a known vendor", () => {
    for (const slot of marketplace.featured) {
      expect(findVendor(slot.ref.vendor)).not.toBeNull();
    }
  });

  // Structural half of the GOL-440 slug guard (the network half —
  // "does the slug resolve in the seeded catalog?" — lives in
  // featured-slugs.live.test.ts). These catch the failure classes that don't
  // need Odoo: an empty row, a coming-soon vendor featured before it has
  // inventory, or a duplicate card.
  it("featured row is non-empty", () => {
    // fetchFeaturedProducts drops unresolvable refs silently, so an empty
    // featured[] and a fully-unresolved featured[] both render the same blank
    // row. Keeping at least one curated slot means the row is intentional.
    expect(marketplace.featured.length).toBeGreaterThan(0);
  });

  it("no featured slot points at a coming-soon vendor", () => {
    for (const slot of marketplace.featured) {
      const vendor = findVendor(slot.ref.vendor)!;
      expect(
        vendor.comingSoon,
        `featured slot "${slot.ref.productSlug}" points at coming-soon vendor "${vendor.slug}"`,
      ).toBeUndefined();
    }
  });

  it("featured product refs are unique (no duplicate cards)", () => {
    const keys = marketplace.featured.map(
      (s) => `${s.ref.vendor}/${s.ref.productSlug}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every journal link references a known vendor", () => {
    for (const link of marketplace.journalLinks) {
      expect(findVendor(link.ref.vendor)).not.toBeNull();
    }
  });

  it("vendor slugs are unique", () => {
    const slugs = marketplace.vendors.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("vendor brand colors are valid hex", () => {
    for (const v of marketplace.vendors) {
      expect(v.brandColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("vendor homepage URLs are absolute https", () => {
    for (const v of marketplace.vendors) {
      expect(v.homepageUrl).toMatch(/^https:\/\//);
    }
  });

  it("buildCheckoutUrl interpolates productId and uses default template", () => {
    const goldberry = findVendor("goldberry")!;
    const url = buildCheckoutUrl(goldberry, 42);
    expect(url).toBe(
      "https://goldberrygrove.farm/shop/cart/update?product_id=42&add_qty=1",
    );
  });
});
