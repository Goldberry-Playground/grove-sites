import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOdooClient,
  PRODUCT_CATALOG_CACHE_TAG,
  PRODUCT_DISPLAY_REVALIDATE_SECONDS,
  PRODUCT_SLUG_REVALIDATE_SECONDS,
  productCacheTag,
} from "./client";

type Init = RequestInit & { next?: { revalidate?: number; tags?: string[] } };

const detail = {
  id: 42,
  slug: "hickory",
  name: "Hickory",
  list_price: 28,
  default_code: false,
  website_published: true,
  grove_featured: false,
  image_url: false,
  description_sale: false,
  grove_seo_description: false,
  categ_id: false,
  currency_id: false,
  variants: [],
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const listOf = (results: unknown[]) =>
  json({ count: results.length, limit: 40, offset: 0, results });

const client = () => createOdooClient({ tenantId: "nursery", odooUrl: "http://odoo.test" });
const initOf = (call: number) => vi.mocked(fetch).mock.calls[call][1] as Init;

describe("product read freshness", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("keeps get() live by default, because checkout prices from it", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(detail));
    await client().products.get(42);
    expect(initOf(0).next).toBeUndefined();
  });

  it("caches a display get() for the bounded window under the product's tag", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(detail));
    await client().products.get(42, { freshness: "display" });
    expect(initOf(0).next).toEqual({
      revalidate: PRODUCT_DISPLAY_REVALIDATE_SECONDS,
      tags: [productCacheTag(42)],
    });
  });

  it("keeps getBySlug() live by default", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(listOf([detail])).mockResolvedValueOnce(json(detail));
    await client().products.getBySlug("hickory");
    expect(initOf(0).next).toBeUndefined();
    expect(initOf(1).next).toBeUndefined();
  });

  it("caches both hops of a display getBySlug()", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(listOf([detail])).mockResolvedValueOnce(json(detail));
    await client().products.getBySlug("hickory", { freshness: "display" });
    expect(initOf(0).next?.revalidate).toBe(PRODUCT_SLUG_REVALIDATE_SECONDS);
    expect(initOf(1).next).toEqual({
      revalidate: PRODUCT_DISPLAY_REVALIDATE_SECONDS,
      tags: [productCacheTag(42)],
    });
  });

  it("re-checks live before trusting a cached empty slug, so a new product never 404s", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(listOf([]))
      .mockResolvedValueOnce(listOf([detail]))
      .mockResolvedValueOnce(json(detail));
    const product = await client().products.getBySlug("hickory", { freshness: "display" });
    expect(initOf(1).cache).toBe("no-store");
    expect(product?.id).toBe(42);
  });

  it("treats a cached slug whose product was unpublished as not found", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(listOf([detail]))
      .mockResolvedValueOnce(new Response("gone", { status: 404 }))
      .mockResolvedValueOnce(listOf([]));
    await expect(
      client().products.getBySlug("hickory", { freshness: "display" }),
    ).resolves.toBeNull();
    expect(initOf(2).next).toBeUndefined();
  });

  it("returns null when the live re-check is also empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(listOf([])).mockResolvedValueOnce(listOf([]));
    await expect(
      client().products.getBySlug("nope", { freshness: "display" }),
    ).resolves.toBeNull();
  });

  it("list() caches 30s under the catalog tag", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(listOf([]));
    await client().products.list();
    expect(initOf(0).next).toEqual({ revalidate: 30, tags: [PRODUCT_CATALOG_CACHE_TAG] });
  });

  it("display getBySlug tags the slug lookup with the catalog tag", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(listOf([detail])).mockResolvedValueOnce(json(detail));
    await client().products.getBySlug("hickory", { freshness: "display" });
    expect(initOf(0).next?.tags).toContain(PRODUCT_CATALOG_CACHE_TAG);
  });

  it("nav() caches 30s under the catalog tag", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ departments: [], categories: [] }));
    await client().catalog.nav().catch(() => undefined);
    expect(initOf(0).next).toEqual({ revalidate: 30, tags: [PRODUCT_CATALOG_CACHE_TAG] });
  });
});
