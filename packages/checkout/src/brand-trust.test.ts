import { describe, it, expect } from "vitest";
import { BRAND_TRUST, type GroveBrand } from "./brand-trust";

// GOL-1090: the cart/checkout trust strip used to be hardcoded to the nursery's
// live-plant "arrive-alive guarantee" and shared across every tenant, so a
// woodworking storefront (ggg) and a pantry-goods hub (goldberry) advertised a
// promise that is false for their products. These tests pin the invariant:
// only the nursery — the one brand that ships living plants — may make that
// claim, and every strip stays icon+text (color-independent) and non-empty.

const BRANDS: GroveBrand[] = ["nursery", "ggg", "goldberry"];
const NON_LIVING_BRANDS: GroveBrand[] = ["ggg", "goldberry"];

function allText(brand: GroveBrand): string {
  const { cart, checkout } = BRAND_TRUST[brand];
  return [...cart, ...checkout]
    .map((t) => t.text)
    .join(" | ")
    .toLowerCase();
}

describe("BRAND_TRUST — per-brand truthfulness (GOL-1090)", () => {
  it("only the nursery carries the live-plant arrive-alive guarantee", () => {
    expect(allText("nursery")).toContain("arrive-alive");
    for (const brand of NON_LIVING_BRANDS) {
      expect(allText(brand)).not.toContain("arrive-alive");
      expect(allText(brand)).not.toContain("alive");
    }
  });

  it("every brand defines a non-empty cart and checkout strip", () => {
    for (const brand of BRANDS) {
      expect(BRAND_TRUST[brand].cart.length).toBeGreaterThan(0);
      expect(BRAND_TRUST[brand].checkout.length).toBeGreaterThan(0);
    }
  });

  it("every badge pairs a decorative icon with meaning-bearing text", () => {
    for (const brand of BRANDS) {
      const { cart, checkout } = BRAND_TRUST[brand];
      for (const item of [...cart, ...checkout]) {
        // Text carries the meaning (icon is aria-hidden at render) — so text
        // must be present; icon is optional-but-present for visual rhythm.
        expect(item.text.trim().length).toBeGreaterThan(0);
        expect(item.icon.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
