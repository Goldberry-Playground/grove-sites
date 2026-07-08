import { describe, expect, it } from "vitest";

import { resolveOdooImageUrl } from "./images";

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
