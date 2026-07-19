import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../clients", () => ({
  clientForVendor: vi.fn(),
}));

import { clientForVendor } from "../clients";
import {
  fetchProductByVendorSlug,
  fetchFeaturedProducts,
} from "../marketplace";
import { marketplace } from "../../data/marketplace";

function mockClient(products: Array<{ slug: string; id: number; name: string }>) {
  return {
    health: vi.fn(),
    products: {
      list: vi.fn(async () => ({
        count: products.length,
        limit: 40,
        offset: 0,
        products: products.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          sku: null,
          description: null,
          seoDescription: null,
          price: 0,
          currency: "USD",
          imageUrl: "",
          categoryId: null,
          categoryName: null,
          available: true,
          featured: false,
          variants: [],
        })),
      })),
      get: vi.fn(),
      getBySlug: vi.fn(async (slug: string) => {
        const match = products.find((p) => p.slug === slug);
        if (!match) return null;
        return {
          id: match.id,
          slug: match.slug,
          name: match.name,
          sku: null,
          description: null,
          seoDescription: null,
          price: 0,
          currency: "USD",
          imageUrl: "",
          categoryId: null,
          categoryName: null,
          available: true,
          featured: false,
          variants: [],
        };
      }),
    },
    cart: { get: vi.fn(), addItem: vi.fn() },
    orders: { create: vi.fn(), get: vi.fn() },
  };
}

describe("hub/lib/marketplace federation", () => {
  beforeEach(() => {
    vi.mocked(clientForVendor).mockReset();
  });

  it("fetchProductByVendorSlug returns merged product + vendor", async () => {
    vi.mocked(clientForVendor).mockReturnValue(
      mockClient([{ id: 42, slug: "shagbark-hickory-syrup", name: "Shagbark Hickory Syrup" }]) as never,
    );

    const result = await fetchProductByVendorSlug("goldberry", "shagbark-hickory-syrup");
    expect(result).not.toBeNull();
    expect(result?.product.name).toBe("Shagbark Hickory Syrup");
    expect(result?.vendor.slug).toBe("goldberry");
  });

  it("fetchProductByVendorSlug returns null for unknown vendor", async () => {
    const result = await fetchProductByVendorSlug("ghost", "anything");
    expect(result).toBeNull();
  });

  it("fetchProductByVendorSlug returns null when vendor's catalog has no match", async () => {
    vi.mocked(clientForVendor).mockReturnValue(mockClient([]) as never);
    const result = await fetchProductByVendorSlug("goldberry", "missing-product");
    expect(result).toBeNull();
  });

  it("fetchFeaturedProducts joins overlay editorialNote with canonical product", async () => {
    // This test couples to the live featured[] overlay in data/marketplace.ts.
    // Rather than hardcode slug/copy fixtures (which churn every catalog rotation
    // and every editorial reword — 2026-07-18 GOL-440 retargeted goldberry
    // stickers → seeded nursery SKUs), derive the fixtures from the overlay
    // itself and assert the JOIN: each resolved card carries the exact
    // editorialNote the overlay declared for that slot.
    const seeded = marketplace.featured.map((slot, i) => ({
      id: 100 + i,
      slug: slot.ref.productSlug,
      name: slot.ref.productSlug,
    }));
    vi.mocked(clientForVendor).mockReturnValue(mockClient(seeded) as never);

    const featured = await fetchFeaturedProducts();
    expect(featured).toHaveLength(marketplace.featured.length);
    for (const slot of marketplace.featured) {
      const card = featured.find((f) => f.product.slug === slot.ref.productSlug);
      expect(card, `featured card for "${slot.ref.productSlug}" did not resolve`).toBeDefined();
      expect(card?.editorialNote).toBe(slot.editorialNote);
    }
  });

  it("fetchFeaturedProducts silently skips refs whose product was deleted", async () => {
    vi.mocked(clientForVendor).mockReturnValue(mockClient([]) as never);
    const featured = await fetchFeaturedProducts();
    expect(featured).toEqual([]);
  });
});
