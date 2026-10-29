// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GOL-3315 (gom printify spec, Storefront §1/§2): goldberrygrove.farm/shop
 * shows ONLY what Odoo lists. The demo catalog (flour, freeze-dried fruit,
 * jams, the shiitake kit) used to render whenever Odoo was down or empty,
 * behind a "Demo catalog" banner, with four category tabs. Production must
 * never show a product it cannot sell: an empty or failed list is the
 * restocking state, nothing else.
 *
 * These render the REAL async Server Component so the assertions are about
 * what a visitor receives.
 */

const list = vi.fn();
vi.mock("../../lib/clients", () => ({ odoo: { products: { list } } }));

async function render() {
  const { default: ShopPage } = await import("./page");
  return renderToStaticMarkup((await ShopPage({ searchParams: Promise.resolve({}) })) as never);
}

const shirt = {
  id: 7,
  slug: "grove-tee",
  name: "Grove Tee",
  sku: "",
  description: "",
  seoDescription: "",
  price: 28,
  currency: "USD",
  imageUrl: "",
  categoryId: 1,
  categoryName: "Shirts",
  available: true,
  featured: false,
  variants: [],
  fulfillmentRoute: "printify",
  leadTime: "3 to 7 business days",
};

describe("goldberry shop reads Odoo only (GOL-3315)", () => {
  // Braces matter: `mockReset()` returns the mock, and vitest 4 runs a function
  // returned from `beforeEach` as a cleanup hook, which would call `list()`.
  beforeEach(() => {
    list.mockReset();
  });

  it("renders Odoo products and no demo banner", async () => {
    list.mockResolvedValue({ products: [shirt] });
    const html = await render();
    expect(html).toContain("Grove Tee");
    expect(html).toContain("/shop/7");
    expect(html).not.toContain("Demo catalog");
    expect(html).not.toContain("Chestnut Flour");
  });

  // The list endpoint hands back image_128; stretched over a ~380 px card it
  // reads as blurry, so the grid asks Odoo for the 1024 px rung instead.
  it("requests the 1024px image rung, not the list thumbnail", async () => {
    list.mockResolvedValue({
      products: [{ ...shirt, imageUrl: "/web/image/product.template/7/image_128" }],
    });
    const html = await render();
    expect(html).toContain("image_1024");
    expect(html).not.toContain("image_128");
  });

  it("shows the restocking state when Odoo is down, never fake products", async () => {
    list.mockRejectedValue(new Error("down"));
    const html = await render();
    expect(html).toContain("The shop is restocking. Check back soon.");
    expect(html).not.toContain("Chestnut Flour");
    expect(html).not.toContain("Demo catalog");
  });

  it("shows the restocking state when Odoo returns nothing", async () => {
    list.mockResolvedValue({ products: [] });
    const html = await render();
    expect(html).toContain("The shop is restocking. Check back soon.");
    expect(html).not.toContain("Chestnut Flour");
  });

  it("has no category tabs and ignores a stale ?cat= query", async () => {
    list.mockResolvedValue({ products: [shirt] });
    const { default: ShopPage } = await import("./page");
    const html = renderToStaticMarkup(
      (await ShopPage({ searchParams: Promise.resolve({ cat: "freeze-dried" }) })) as never,
    );
    expect(html).toContain("Grove Tee");
    expect(html).not.toContain("Freeze-Dried");
    expect(html).not.toContain("?cat=");
  });
});
