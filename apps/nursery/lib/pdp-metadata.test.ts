import { describe, it, expect } from "vitest";
import type { Product } from "@grove/odoo-client";
import {
  resolvePdpCopy,
  buildPdpMetadata,
  notFoundMetadata,
  fallbackDescription,
  FEED_DESCRIPTION_MIN_LENGTH,
  FEED_DESCRIPTION_MAX_LENGTH,
} from "./pdp-metadata";
import { PDP_SEO_COPY } from "../data/pdp-seo-copy";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 93,
    slug: "american-chestnut",
    name: "American Chestnut",
    sku: null,
    description: null,
    seoDescription: null,
    price: 12,
    currency: "USD",
    imageUrl: "/web/image/product.template/93/image_128",
    categoryId: null,
    categoryName: null,
    available: true,
    featured: false,
    variants: [],
    ...overrides,
  } as Product;
}

describe("resolvePdpCopy precedence", () => {
  it("uses the staged copy for a known product", () => {
    const { title, description, source } = resolvePdpCopy(product());
    expect(title).toBe("American Chestnut — Farm Pickup");
    expect(description).toBe(PDP_SEO_COPY[93].description);
    expect(source).toEqual({ title: "staged", description: "staged" });
  });

  it("keeps reviewed copy ahead of the live feed value", () => {
    // Regression guard for what rendering /shop/93 actually showed when the
    // feed won: 179 chars of "A large, fast-growing deciduous tree in the beech
    // family…", which drops the pickup-only line GOL-2874 requires.
    const live =
      "A large, fast-growing deciduous tree in the beech family that once dominated the forests of the eastern United States before being nearly wiped out by an introduced fungal blight.";
    const { description, source } = resolvePdpCopy(product({ seoDescription: live }));
    expect(description).toBe(PDP_SEO_COPY[93].description);
    expect(description).toMatch(/pickup only/i);
    expect(source.description).toBe("staged");
  });

  it("uses a well-sized feed description for a product with no reviewed copy", () => {
    const feed = "x".repeat(FEED_DESCRIPTION_MIN_LENGTH);
    const { description, source } = resolvePdpCopy(
      product({ id: 28, name: "Shagbark Hickory", seoDescription: feed }),
    );
    expect(description).toBe(feed);
    expect(source.description).toBe("feed");
  });

  it("rejects a feed description outside the length window", () => {
    // Live values today: id 22 is 68 chars (a stub), id 91 is 302 (an essay
    // Google cuts mid-sentence). Neither is usable as a meta description.
    for (const length of [FEED_DESCRIPTION_MIN_LENGTH - 1, FEED_DESCRIPTION_MAX_LENGTH + 1]) {
      const p = product({ id: 28, name: "Shagbark Hickory", seoDescription: "x".repeat(length) });
      expect(resolvePdpCopy(p).source.description, `length ${length}`).toBe("fallback");
    }
  });

  it("ignores a whitespace-only feed description", () => {
    const { source } = resolvePdpCopy(
      product({ id: 28, name: "Shagbark Hickory", seoDescription: "   \n  " }),
    );
    expect(source.description).toBe("fallback");
  });

  it("falls back for a product with no staged copy, without inventing claims", () => {
    // Id 28 Shagbark Hickory is published-but-archived on prod; un-archiving it
    // ships a PDP nobody wrote copy for. It must still get its own title.
    const p = product({ id: 28, name: "Shagbark Hickory", slug: "shagbark-hickory" });
    const { title, description, source } = resolvePdpCopy(p);
    expect(title).toBe("Shagbark Hickory");
    expect(description).toBe(fallbackDescription(p));
    expect(source).toEqual({ title: "fallback", description: "fallback" });
    // No zone number, no stock state, no shipping promise.
    expect(description).not.toMatch(/zone \d|in stock|sold out|ships/i);
  });
});

describe("staged copy quality bar", () => {
  const BRAND_SUFFIX_LENGTH = " | At The Grove Nursery".length;

  it("renders every title inside the ~60 char budget with the brand suffix", () => {
    for (const [id, copy] of Object.entries(PDP_SEO_COPY)) {
      const rendered = copy.title.length + BRAND_SUFFIX_LENGTH;
      expect(rendered, `product ${id} title too long (${rendered})`).toBeLessThanOrEqual(60);
    }
  });

  it("keeps every description in the range Google renders", () => {
    for (const [id, copy] of Object.entries(PDP_SEO_COPY)) {
      expect(copy.description.length, `product ${id} description`).toBeGreaterThanOrEqual(120);
      expect(copy.description.length, `product ${id} description`).toBeLessThanOrEqual(160);
    }
  });

  it("has no duplicate titles or descriptions — the defect this ticket fixes", () => {
    const titles = Object.values(PDP_SEO_COPY).map((c) => c.title);
    const descriptions = Object.values(PDP_SEO_COPY).map((c) => c.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("never bakes stock state into a description", () => {
    // Id 132 flipped in_stock false -> true inside one day during the audit;
    // a meta description is cached for weeks.
    for (const [id, copy] of Object.entries(PDP_SEO_COPY)) {
      expect(copy.description, `product ${id}`).not.toMatch(
        /sold out|in stock|out of stock|back in stock/i,
      );
    }
  });

  it("makes no shipping promise on the pickup-only chestnut", () => {
    // grove_pickup_only is true on product 93 (GOL-2874).
    expect(PDP_SEO_COPY[93].description).toMatch(/pickup only/i);
    expect(PDP_SEO_COPY[93].description).not.toMatch(/ships to|we ship|delivered to your door/i);
  });

  it("asserts no binomial on the chestnut while GOL-2874 is open", () => {
    expect(PDP_SEO_COPY[93].title + PDP_SEO_COPY[93].description).not.toMatch(/dentata/i);
  });
});

describe("buildPdpMetadata", () => {
  const odooBase = "https://odoo.gatheringatthegrove.com";

  it("puts the canonical and og:url on the same path", () => {
    const meta = buildPdpMetadata({
      product: product(),
      canonicalPath: "/shop/93",
      odooBase,
    });
    expect(meta.alternates?.canonical).toBe("/shop/93");
    expect(meta.openGraph?.url).toBe("/shop/93");
  });

  it("takes the canonical path from the caller, so Phase 2 can pass a slug", () => {
    const meta = buildPdpMetadata({
      product: product(),
      canonicalPath: "/shop/american-chestnut",
      odooBase,
    });
    expect(meta.alternates?.canonical).toBe("/shop/american-chestnut");
    expect(meta.openGraph?.url).toBe("/shop/american-chestnut");
  });

  it("uses an absolute product photo at a share-card size for og:image", () => {
    const meta = buildPdpMetadata({ product: product(), canonicalPath: "/shop/93", odooBase });
    const images = meta.openGraph?.images as Array<{ url: string }>;
    expect(images[0].url).toBe(`${odooBase}/web/image/product.template/93/image_1024`);
  });

  it("falls back to the site share card when a product has no photo", () => {
    const meta = buildPdpMetadata({
      product: product({ imageUrl: "" }),
      canonicalPath: "/shop/93",
      odooBase,
    });
    const images = meta.openGraph?.images as Array<{ url: string; width: number }>;
    expect(images[0].url).toBe("/brand/og-default.jpg");
    expect(images[0].width).toBe(1200);
  });

  it("leaves the brand suffix to the layout template on og:title", () => {
    // Regression guard: adding the suffix here rendered `og:title` as
    // "… | At The Grove Nursery | At The Grove Nursery". Next DOES apply the
    // root layout's openGraph.title template to a child's string.
    const meta = buildPdpMetadata({ product: product(), canonicalPath: "/shop/93", odooBase });
    expect(meta.openGraph?.title).toBe("American Chestnut — Farm Pickup");
    expect(meta.twitter?.title).toBe("American Chestnut — Farm Pickup");
  });

  it("requests a large summary card so the photo is not a thumbnail", () => {
    const meta = buildPdpMetadata({ product: product(), canonicalPath: "/shop/93", odooBase });
    expect((meta.twitter as { card?: string }).card).toBe("summary_large_image");
  });
});

describe("notFoundMetadata", () => {
  it("noindexes an unresolvable PDP", () => {
    // Load-bearing while /shop/<unknown> still answers 200 with a 404 body.
    expect(notFoundMetadata().robots).toEqual({ index: false, follow: false });
  });
});
