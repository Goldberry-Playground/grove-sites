import { describe, expect, it } from "vitest";
import { isProductIdSegment, isUsableSlug, productPath } from "./product-path";

describe("productPath (GOL-3601)", () => {
  it("links the slug form when the product has a usable slug", () => {
    expect(productPath({ id: 93, slug: "american-chestnut" })).toBe("/shop/american-chestnut");
  });

  it("falls back to the id form for a blank slug (R4: fail open, never 404)", () => {
    expect(productPath({ id: 93, slug: "" })).toBe("/shop/93");
    expect(productPath({ id: 93, slug: null })).toBe("/shop/93");
    expect(productPath({ id: 93 })).toBe("/shop/93");
  });

  it("never links a slug the route would misread as an id", () => {
    expect(productPath({ id: 93, slug: "1999" })).toBe("/shop/93");
  });

  it("rejects slugs that are not lowercase kebab-case", () => {
    expect(isUsableSlug("American-Chestnut")).toBe(false);
    expect(isUsableSlug("american chestnut")).toBe(false);
    expect(isUsableSlug("-chestnut")).toBe(false);
    expect(isUsableSlug("chestnut-")).toBe(false);
    expect(isUsableSlug("black-walnut-northern")).toBe(true);
  });

  it("treats only all-digit segments as product ids", () => {
    expect(isProductIdSegment("93")).toBe(true);
    expect(isProductIdSegment("93a")).toBe(false);
    expect(isProductIdSegment("american-chestnut")).toBe(false);
  });
});
