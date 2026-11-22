import { describe, it, expect } from "vitest";
import type { Product, ProductVariant } from "@grove/odoo-client";
import { buildProductJsonLd, resolveOffer } from "./product-json-ld";
import { resolvePdpCopy } from "./pdp-metadata";

const ODOO = "https://odoo.example.com";

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 1,
    name: "Potted",
    sku: null,
    price: 30,
    available: true,
    imageUrl: "",
    format: "Potted",
    shippingTier: "potted",
    ...overrides,
  } as ProductVariant;
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 22,
    slug: "american-hazelnut",
    name: "American Hazelnut",
    sku: null,
    description: null,
    seoDescription: null,
    price: 30,
    currency: "USD",
    imageUrl: "/web/image/product.template/22/image_1920",
    categoryId: null,
    categoryName: null,
    available: true,
    featured: false,
    variants: [],
    ...overrides,
  } as Product;
}

function build(p: Product) {
  return buildProductJsonLd({ product: p, canonicalPath: `/shop/${p.slug}`, odooBase: ODOO });
}

describe("buildProductJsonLd", () => {
  it("emits one Product with an Offer on the canonical slug URL", () => {
    const p = product({
      variants: [
        variant({ id: 1, price: 30 }),
        variant({ id: 2, price: 18, format: "Bareroot", shippingTier: "bareroot" }),
      ],
    });
    const block = build(p)!;
    expect(block["@context"]).toBe("https://schema.org");
    expect(block["@type"]).toBe("Product");
    expect(block.name).toBe("American Hazelnut");
    expect(block.url).toBe("https://atthegrovenursery.com/shop/american-hazelnut");
    expect(block.offers).toEqual({
      "@type": "Offer",
      url: "https://atthegrovenursery.com/shop/american-hazelnut",
      price: "18.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    });
  });

  it("shares its description and image with the page metadata", () => {
    const p = product();
    const block = build(p)!;
    expect(block.description).toBe(resolvePdpCopy(p).description);
    expect(block.image).toBe(`${ODOO}/web/image/product.template/22/image_1024`);
  });

  it("never carries reviews, ratings or shipping details", () => {
    const text = JSON.stringify(build(product({ pickupOnly: true })));
    expect(text).not.toMatch(/aggregateRating|review|shippingDetails|shippingRate/i);
  });

  it("marks a pickup-only product InStoreOnly with on-site pickup, not shipping", () => {
    const block = build(
      product({ id: 93, slug: "american-chestnut", name: "American Chestnut", pickupOnly: true, price: 12 }),
    )!;
    expect(block.offers.availability).toBe("https://schema.org/InStoreOnly");
    expect(block.offers.availableDeliveryMethod).toBe("https://schema.org/OnSitePickup");
    expect(block.description).toMatch(/pickup only/i);
  });

  it("omits the image when the product has none, and absolutizes a site-relative one", () => {
    expect(build(product({ imageUrl: "" }))).not.toHaveProperty("image");
    expect(build(product({ imageUrl: "/products/hazelnut.jpg" }))!.image).toBe(
      "https://atthegrovenursery.com/products/hazelnut.jpg",
    );
  });

  it("returns null rather than advertise a $0 offer", () => {
    expect(build(product({ price: 0 }))).toBeNull();
  });
});

describe("resolveOffer availability follows the buy box", () => {
  it("prices from the lowest variant that is actually on hand", () => {
    const offer = resolveOffer(
      product({
        variants: [
          variant({ price: 30 }),
          variant({ price: 18, available: false, format: "Bareroot", shippingTier: "bareroot" }),
        ],
      }),
    );
    expect(offer).toEqual({ availability: "InStock", price: 30 });
  });

  it("reads a sold-out Bareroot that still takes reservations as PreOrder", () => {
    const offer = resolveOffer(
      product({
        available: false,
        variants: [
          variant({ price: 30, available: false }),
          variant({ price: 18, available: false, format: "Bareroot", shippingTier: "bareroot" }),
        ],
      }),
    );
    expect(offer).toEqual({ availability: "PreOrder", price: 18 });
  });

  it("is OutOfStock when sold out, when the preorder cap is reached, or when not for sale", () => {
    const bareroot = variant({ price: 18, available: false, format: "Bareroot", shippingTier: "bareroot" });
    expect(
      resolveOffer(product({ available: false, variants: [variant({ available: false })] })).availability,
    ).toBe("OutOfStock");
    expect(
      resolveOffer(product({ available: false, preorderCapReached: true, variants: [bareroot] })).availability,
    ).toBe("OutOfStock");
    expect(resolveOffer(product({ saleOk: false, variants: [variant()] })).availability).toBe("OutOfStock");
  });

  it("keeps a sold-out pickup-only product OutOfStock, never InStoreOnly", () => {
    expect(resolveOffer(product({ available: false, pickupOnly: true })).availability).toBe("OutOfStock");
  });

  it("falls back to the product price and stock when there are no variants", () => {
    expect(resolveOffer(product({ price: 12 }))).toEqual({ availability: "InStock", price: 12 });
  });

  it("treats a seed product as PreOrder only while its season is open", () => {
    const pack = variant({ price: 9, available: false, shippingTier: "seed", format: null });
    const season = { year: 2027, shipStart: "", shipEnd: "", orderBy: "", rolledOver: false, reason: null };
    expect(
      resolveOffer(product({ variants: [pack], seedSeason: { ...season, open: true } })).availability,
    ).toBe("PreOrder");
    expect(
      resolveOffer(product({ variants: [pack], seedSeason: { ...season, open: false } })).availability,
    ).toBe("OutOfStock");
  });
});
