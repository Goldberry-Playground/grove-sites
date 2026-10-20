// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductCard } from "../ProductCard";
import type { HubProduct } from "../../lib/marketplace";
import type { Vendor } from "../../data/marketplace";

const nursery: Vendor = {
  slug: "nursery",
  name: "At The Grove Nursery",
  tagline: "test",
  story: "test",
  brandColor: "#1F3F2B",
  homepageUrl: "https://atthegrovenursery.com",
  odoo: { apiUrl: "https://odoo.qa.gatheringatthegrove.com", tenantSlug: "nursery" },
};

function hubProduct(imageUrl: string): HubProduct {
  return {
    vendor: nursery,
    product: {
      id: 151,
      slug: "chestnut",
      name: "Chestnut",
      sku: null,
      description: null,
      seoDescription: null,
      price: 42,
      currency: null,
      imageUrl,
      categoryId: null,
      categoryName: null,
      tags: [],
      categories: [],
    } as unknown as HubProduct["product"],
  };
}

/**
 * GOL-3477 — the marketplace grid serves Odoo photos through next/image and
 * marks exactly the first card eager. These assert the rendered <img>
 * contract Lighthouse sees, not next/image internals.
 */
describe("hub ProductCard image (GOL-3477)", () => {
  it("routes the Odoo photo through the image optimizer with a responsive srcset", () => {
    const { container } = render(
      <ProductCard product={hubProduct("/web/image/product.template/151/image_1920")} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    // next/image rewrites src to /_next/image?url=<encoded master>&w=…&q=82
    expect(img!.getAttribute("src")).toMatch(/^\/_next\/image\?url=/);
    expect(decodeURIComponent(img!.getAttribute("src")!)).toContain(
      "https://odoo.qa.gatheringatthegrove.com/web/image/product.template/151/image_1024",
    );
    expect(img!.getAttribute("srcset")).toMatch(/ \d+w/);
    expect(img!.getAttribute("sizes")).toBe("(max-width: 720px) calc(100vw - 2rem), 300px");
  });

  it("reserves an intrinsic 1:1 size on every card photo", () => {
    const { container } = render(
      <ProductCard product={hubProduct("/web/image/product.template/191/image_128")} />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("600");
    expect(img.getAttribute("height")).toBe("600");
  });

  it("keeps a non-priority card lazy", () => {
    const { container } = render(
      <ProductCard product={hubProduct("/web/image/product.template/191/image_128")} />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("fetchpriority")).toBeNull();
  });

  it("loads the priority (first-row LCP) card eagerly at high fetch priority", () => {
    const { container } = render(
      <ProductCard product={hubProduct("/web/image/product.template/151/image_1920")} priority />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("loading")).not.toBe("lazy");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("renders an empty frame, not a broken image, when there is no photo", () => {
    const { container } = render(<ProductCard product={hubProduct("")} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".product-card__image")).not.toBeNull();
  });
});
