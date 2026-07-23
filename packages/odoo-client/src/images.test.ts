import { describe, expect, it } from "vitest";

import { resolveOdooImageUrl, withOdooImageSize } from "./images";

const BASE = "https://odoo.qa.gatheringatthegrove.com";

describe("resolveOdooImageUrl", () => {
  it("prefixes Odoo /web/image paths with the Odoo base", () => {
    expect(resolveOdooImageUrl("/web/image/product.template/2/image_128", BASE)).toBe(
      `${BASE}/web/image/product.template/2/image_128`,
    );
  });

  it("returns empty string for missing images", () => {
    expect(resolveOdooImageUrl("", BASE)).toBe("");
    expect(resolveOdooImageUrl(null, BASE)).toBe("");
    expect(resolveOdooImageUrl(undefined, BASE)).toBe("");
  });

  it("passes absolute URLs through unchanged", () => {
    expect(resolveOdooImageUrl("https://images.example.com/x.webp", BASE)).toBe(
      "https://images.example.com/x.webp",
    );
  });

  it("passes data: URIs through unchanged", () => {
    expect(resolveOdooImageUrl("data:image/svg+xml;base64,abc", BASE)).toBe(
      "data:image/svg+xml;base64,abc",
    );
  });

  it("leaves app-local static assets relative", () => {
    for (const p of ["/products/tree.webp", "/hero/banner.webp", "/photos/farm.webp"]) {
      expect(resolveOdooImageUrl(p, BASE)).toBe(p);
    }
  });

  it("prefixes bare relative paths defensively", () => {
    expect(resolveOdooImageUrl("web/image/product.template/2/image_128", BASE)).toBe(
      `${BASE}web/image/product.template/2/image_128`,
    );
  });
});

describe("withOdooImageSize", () => {
  it("upgrades the resolution suffix on Odoo image paths (GOL-761)", () => {
    expect(withOdooImageSize("/web/image/product.template/2/image_128", 1024)).toBe(
      "/web/image/product.template/2/image_1024",
    );
  });

  it("rewrites from any rung of the ladder", () => {
    expect(withOdooImageSize("/web/image/product.template/2/image_1920", 512)).toBe(
      "/web/image/product.template/2/image_512",
    );
    expect(withOdooImageSize("/web/image/product.product/3/image_256", 1024)).toBe(
      "/web/image/product.product/3/image_1024",
    );
  });

  it("only touches the image_<n> segment, not the id", () => {
    expect(withOdooImageSize("/web/image/product.template/128/image_128", 512)).toBe(
      "/web/image/product.template/128/image_512",
    );
  });

  it("leaves non-Odoo assets untouched", () => {
    for (const p of ["/products/tree.webp", "https://images.example.com/x.webp", "data:image/png;base64,abc"]) {
      expect(withOdooImageSize(p, 1024)).toBe(p);
    }
  });

  it("returns empty string for missing images", () => {
    expect(withOdooImageSize("", 1024)).toBe("");
    expect(withOdooImageSize(null, 1024)).toBe("");
    expect(withOdooImageSize(undefined, 1024)).toBe("");
  });
});
