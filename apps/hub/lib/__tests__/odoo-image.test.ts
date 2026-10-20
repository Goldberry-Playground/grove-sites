import { describe, expect, it } from "vitest";
import { MARKETPLACE_CARD_SIZES, firstPhotoIndex, odooImageAt } from "../odoo-image";

describe("odooImageAt (GOL-3477)", () => {
  it("re-points the list endpoint's 128px thumbnail at the 1024 master", () => {
    expect(odooImageAt("/web/image/product.template/191/image_128")).toBe(
      "/web/image/product.template/191/image_1024",
    );
  });

  it("re-points the detail endpoint's full upload at the 1024 master", () => {
    expect(
      odooImageAt("https://odoo.qa.gatheringatthegrove.com/web/image/product.template/151/image_1920"),
    ).toBe("https://odoo.qa.gatheringatthegrove.com/web/image/product.template/151/image_1024");
  });

  it("handles product.product variant paths and query strings", () => {
    expect(odooImageAt("/web/image/product.product/2/image_256?unique=abc")).toBe(
      "/web/image/product.product/2/image_1024?unique=abc",
    );
  });

  it("accepts an explicit target field", () => {
    expect(odooImageAt("/web/image/product.template/2/image_1920", "image_512")).toBe(
      "/web/image/product.template/2/image_512",
    );
  });

  it("leaves non-Odoo URLs untouched", () => {
    const cdn = "https://assets.gatheringatthegrove.com/photos/image_128.jpg";
    expect(odooImageAt(cdn)).toBe(cdn);
    expect(odooImageAt("data:image/svg+xml,...")).toBe("data:image/svg+xml,...");
  });

  it("publishes a sizes hint that is one column on phones and capped on desktop", () => {
    expect(MARKETPLACE_CARD_SIZES).toMatch(/max-width: 720px/);
    expect(MARKETPLACE_CARD_SIZES).toMatch(/300px$/);
  });
});

describe("firstPhotoIndex (GOL-3477)", () => {
  const card = (imageUrl: string | null) => ({ product: { imageUrl } });

  it("skips photo-less cards up front (the QA E2E fixture lists first)", () => {
    expect(firstPhotoIndex([card(""), card(null), card("/web/image/x/1/image_128")])).toBe(2);
  });

  it("is 0 when the first card has a photo", () => {
    expect(firstPhotoIndex([card("/web/image/x/1/image_128"), card("/web/image/x/2/image_128")])).toBe(0);
  });

  it("is -1 when nothing has a photo, so no card is marked priority", () => {
    expect(firstPhotoIndex([card(""), card(null)])).toBe(-1);
    expect(firstPhotoIndex([])).toBe(-1);
  });
});
