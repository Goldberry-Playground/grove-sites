import { describe, expect, it, vi, beforeEach } from "vitest";
import { createOdooClient } from "./client";

describe("products.getBySlug", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("calls /grove/api/v1/products?slug=<slug>", async () => {
    const mockFetch = vi.mocked(fetch);
    // getBySlug issues two fetches: list-by-slug, then detail-by-id (to pick
    // up variants[] which the list response omits). Mock both.
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            count: 1,
            limit: 40,
            offset: 0,
            results: [
              {
                id: 42,
                slug: "shagbark-hickory-syrup",
                name: "Shagbark Hickory Syrup",
                list_price: 28,
                default_code: false,
                website_published: true,
                grove_featured: true,
                image_url: "/web/image/product.template/42/image_128",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 42,
            slug: "shagbark-hickory-syrup",
            name: "Shagbark Hickory Syrup",
            list_price: 28,
            default_code: false,
            website_published: true,
            grove_featured: true,
            image_url: "/web/image/product.template/42/image_128",
            description_sale: false,
            grove_seo_description: false,
            categ_id: false,
            currency_id: false,
            website_url: false,
            variants: [],
          }),
          { status: 200 },
        ),
      );

    const client = createOdooClient({
      tenantId: "goldberry",
      odooUrl: "http://localhost:8069",
    });
    const product = await client.products.getBySlug("shagbark-hickory-syrup");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe(
      "http://localhost:8069/grove/api/v1/products?slug=shagbark-hickory-syrup",
    );
    expect(product).not.toBeNull();
    expect(product?.slug).toBe("shagbark-hickory-syrup");
    expect(product?.name).toBe("Shagbark Hickory Syrup");
  });

  it("returns null when slug not found", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ count: 0, limit: 40, offset: 0, results: [] }),
        { status: 200 },
      ),
    );

    const client = createOdooClient({
      tenantId: "goldberry",
      odooUrl: "http://localhost:8069",
    });
    const product = await client.products.getBySlug("nope");
    expect(product).toBeNull();
  });

  it("derives slug from grove_slug when the detail endpoint omits slug (GOL-400)", async () => {
    // Real wire shape: the list endpoint aliases grove_slug → slug, but the
    // detail endpoint returns `grove_slug` and NO `slug` field. Reading
    // raw.slug alone left product.slug === undefined, which rendered featured
    // ProductCard links as /marketplace/goldberry/undefined.
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            count: 1,
            limit: 40,
            offset: 0,
            results: [
              {
                id: 173,
                slug: "samoyed-goldberry-grove-stickers",
                name: "Samoyed Goldberry Grove Stickers",
                list_price: 6,
                default_code: "GB-STICKER-SAMOYED",
                website_published: true,
                grove_featured: true,
                image_url: "/web/image/product.template/173/image_128",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          // Note: NO `slug` key — detail endpoint returns `grove_slug` instead.
          JSON.stringify({
            id: 173,
            grove_slug: "samoyed-goldberry-grove-stickers",
            name: "Samoyed Goldberry Grove Stickers",
            list_price: 6,
            default_code: "GB-STICKER-SAMOYED",
            website_published: true,
            grove_featured: true,
            image_url: "/web/image/product.template/173/image_128",
            description_sale: false,
            grove_seo_description: false,
            categ_id: false,
            currency_id: false,
            website_url: false,
            variants: [],
          }),
          { status: 200 },
        ),
      );

    const client = createOdooClient({
      tenantId: "goldberry",
      odooUrl: "http://localhost:8069",
    });
    const product = await client.products.getBySlug(
      "samoyed-goldberry-grove-stickers",
    );

    expect(product).not.toBeNull();
    expect(product?.slug).toBe("samoyed-goldberry-grove-stickers");
    expect(product?.slug).not.toBe("undefined");
    expect(product?.slug).toBeDefined();
  });
});
