import { describe, it, expect } from "vitest";
import type { Product, PromotionTier } from "@grove/odoo-client";
import { dealBadgeLabel, showsDealBadge, anyOnOffer, filterOnOffer } from "./deals";

/** Deal badges + the conditional "On offer" facet (GOL-2745, spec decision 5). */

function product(over: Partial<Product> & { id: number }): Product {
  return {
    slug: `p${over.id}`,
    name: `Product ${over.id}`,
    sku: null,
    description: null,
    seoDescription: null,
    price: 10,
    currency: null,
    imageUrl: "",
    categoryId: null,
    categoryName: null,
    available: true,
    featured: false,
    variants: [],
    ...over,
  };
}

const TIERS: PromotionTier[] = [
  { minQty: 10, percent: 10, label: "10+" },
  { minQty: 5, percent: 5, label: "5+" },
];

describe("dealBadgeLabel", () => {
  it("names the LOWEST tier, the one a shopper can actually reach", () => {
    expect(dealBadgeLabel(TIERS)).toBe("5+ save");
  });

  it("returns null with no tiers, so a missing program invents no discount", () => {
    // An unreachable Odoo and a backend without /promotions/auto both produce
    // `[]` — neither may paint a badge.
    expect(dealBadgeLabel([])).toBeNull();
  });

  it("ignores a nonsense threshold rather than printing '1+ save'", () => {
    expect(dealBadgeLabel([{ minQty: 1, percent: 5, label: "1+" }])).toBeNull();
  });
});

describe("showsDealBadge", () => {
  it("badges an ordinary plant", () => {
    expect(showsDealBadge(product({ id: 1 }))).toBe(true);
  });

  it("treats an unreported qualification as qualifying", () => {
    // Undefined means "the backend doesn't distinguish yet", and today every
    // published item is a qualifying plant.
    expect(showsDealBadge(product({ id: 2, qualifiesForVolume: undefined }))).toBe(true);
  });

  it("respects an explicit false once Odoo starts reporting", () => {
    expect(showsDealBadge(product({ id: 3, qualifiesForVolume: false }))).toBe(false);
  });

  it("never badges something that can't be bought", () => {
    expect(showsDealBadge(product({ id: 4, saleOk: false }))).toBe(false);
  });
});

describe("anyOnOffer", () => {
  it("is false when nothing reports an offer, so the facet stays hidden", () => {
    // The guard against a filter that always returns nothing between promotions.
    expect(anyOnOffer([product({ id: 1 }), product({ id: 2 })])).toBe(false);
  });

  it("is true as soon as one product is on offer", () => {
    expect(anyOnOffer([product({ id: 1 }), product({ id: 2, onOffer: true })])).toBe(true);
  });

  it("reads an explicit false as not on offer", () => {
    expect(anyOnOffer([product({ id: 1, onOffer: false })])).toBe(false);
  });
});

describe("filterOnOffer", () => {
  it("is a no-op when the facet is off", () => {
    const list = [product({ id: 1 }), product({ id: 2, onOffer: true })];
    expect(filterOnOffer(list, false)).toEqual(list);
  });

  it("keeps only on-offer products when active", () => {
    const offered = product({ id: 2, onOffer: true });
    expect(filterOnOffer([product({ id: 1 }), offered], true)).toEqual([offered]);
  });
});
