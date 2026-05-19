import { describe, expect, it } from "vitest";
import { marketplace, findVendor, buildCheckoutUrl } from "../marketplace";

describe("marketplace.ts integrity", () => {
  it("every featured slot references a known vendor", () => {
    for (const slot of marketplace.featured) {
      expect(findVendor(slot.ref.vendor)).not.toBeNull();
    }
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
