import { describe, it, expect } from "vitest";
import {
  normalizeProductListItem,
  normalizeProductDetail,
  normalizeVariant,
  normalizeCart,
  normalizeCartItem,
  normalizeOrderSummary,
  normalizeOrderDetail,
} from "./normalizers";
import {
  honeycrispListItem,
  honeycrispDetail,
  honeycrispDetailWithStock,
  honeycrispWithMissingFields,
  emptyCart,
  cartWithOneLine,
  orderCreateResponse,
  orderDetail,
} from "./__fixtures__/api-responses";

describe("normalizeProductListItem", () => {
  it("maps the basic shape with all expected fields populated", () => {
    const result = normalizeProductListItem(honeycrispListItem);
    expect(result).toMatchObject({
      id: 2,
      name: "Honeycrisp Apple Tree",
      sku: "TREE-HONEYCRISP",
      price: 38.0,
      imageUrl: "/web/image/product.template/2/image_128",
      available: true,
      featured: false,
      variants: [],
    });
  });

  it("treats default_code: false as null SKU (Odoo's many2one quirk)", () => {
    const result = normalizeProductListItem({
      ...honeycrispListItem,
      default_code: false,
    });
    expect(result.sku).toBeNull();
  });

  it("derives availability from website_published when stock module absent", () => {
    expect(
      normalizeProductListItem({ ...honeycrispListItem, website_published: false })
        .available,
    ).toBe(false);
  });
});

describe("normalizeProductDetail — stock module absent (production today)", () => {
  it("falls back to website_published for availability when qty_available is undefined", () => {
    const result = normalizeProductDetail(honeycrispDetail);
    expect(result.available).toBe(true); // website_published === true
  });

  it("treats published: false as unavailable when qty_available undefined", () => {
    const result = normalizeProductDetail({
      ...honeycrispDetail,
      website_published: false,
    });
    expect(result.available).toBe(false);
  });

  it("unwraps the many2one currency_id tuple to a name string", () => {
    const result = normalizeProductDetail(honeycrispDetail);
    expect(result.currency).toBe("USD");
  });

  it("unwraps the many2one categ_id tuple to id+name pair", () => {
    const result = normalizeProductDetail(honeycrispDetail);
    expect(result.categoryId).toBe(8);
    expect(result.categoryName).toBe("Plants / Trees");
  });

  it("normalizes every variant in the array via normalizeVariant", () => {
    const result = normalizeProductDetail(honeycrispDetail);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].name).toBe(
      "Honeycrisp Apple Tree (3 gal, Nursery Pot)",
    );
  });

  it("handles missing variants array (older API responses)", () => {
    const result = normalizeProductDetail({
      ...honeycrispDetail,
      variants: undefined as unknown as never[],
    });
    expect(result.variants).toEqual([]);
  });
});

describe("normalizeProductDetail — stock module installed", () => {
  it("uses qty_available > 0 when present (parent product)", () => {
    const result = normalizeProductDetail(honeycrispDetailWithStock);
    expect(result.available).toBe(true); // qty_available: 12 > 0
  });

  it("returns unavailable for qty_available === 0 even if published", () => {
    const result = normalizeProductDetail({
      ...honeycrispDetailWithStock,
      qty_available: 0,
    });
    expect(result.available).toBe(false);
  });
});

describe("normalizeProductDetail — Odoo's many2one quirks (false instead of null)", () => {
  it("returns null currency when currency_id is false", () => {
    expect(normalizeProductDetail(honeycrispWithMissingFields).currency).toBeNull();
  });

  it("returns null categoryId/categoryName when categ_id is false", () => {
    const result = normalizeProductDetail(honeycrispWithMissingFields);
    expect(result.categoryId).toBeNull();
    expect(result.categoryName).toBeNull();
  });

  it("returns null description when description_sale is false", () => {
    expect(
      normalizeProductDetail(honeycrispWithMissingFields).description,
    ).toBeNull();
  });
});

describe("normalizeVariant", () => {
  it("uses display_name (which includes attribute combo) — NOT the bare name", () => {
    // Regression test for the bug where every variant was rendering as
    // "Honeycrisp Apple Tree" instead of "Honeycrisp Apple Tree (3 gal, Pot)".
    const variantInput = honeycrispDetail.variants[0];
    expect(normalizeVariant(variantInput).name).toContain("3 gal");
    expect(normalizeVariant(variantInput).name).toContain("Nursery Pot");
  });

  it("treats variant qty_available === 0 as unavailable", () => {
    const variantInput = honeycrispDetailWithStock.variants[1]; // qty_available: 0
    expect(normalizeVariant(variantInput).available).toBe(false);
  });

  it("defaults to available when qty_available undefined (no stock module)", () => {
    const variantInput = honeycrispDetail.variants[0];
    expect(normalizeVariant(variantInput).available).toBe(true);
  });
});

describe("normalizeCart", () => {
  it("returns an empty cart shape when raw cart has no lines", () => {
    const result = normalizeCart(emptyCart);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.id).toBeNull();
  });

  it("preserves amount_untaxed → subtotal and amount_tax → tax", () => {
    const result = normalizeCart(cartWithOneLine);
    expect(result.subtotal).toBe(38.0);
    expect(result.tax).toBe(5.7);
    expect(result.total).toBe(43.7);
  });

  it("defaults missing amount_untaxed and amount_tax to 0", () => {
    const result = normalizeCart({ ...emptyCart, amount_total: 0 });
    expect(result.subtotal).toBe(0);
    expect(result.tax).toBe(0);
  });

  it("unwraps the currency many2one to a name string", () => {
    const result = normalizeCart(cartWithOneLine);
    expect(result.currency).toBe("USD");
  });

  it("returns null currency for an empty cart with no currency context", () => {
    expect(normalizeCart(emptyCart).currency).toBeNull();
  });
});

describe("normalizeCartItem", () => {
  it("maps each line one-to-one preserving subtotal", () => {
    const result = normalizeCartItem(cartWithOneLine.lines[0]);
    expect(result).toEqual({
      id: 1,
      productId: 2,
      name: "Honeycrisp Apple Tree (3 gal, Nursery Pot)",
      quantity: 1,
      unitPrice: 38.0,
      totalPrice: 38.0,
      imageUrl: "/web/image/product.product/2/image_128",
    });
  });
});

describe("normalizeOrderSummary", () => {
  it("renames access_token to accessToken (camelCase) for client consumption", () => {
    const result = normalizeOrderSummary(orderCreateResponse);
    expect(result.accessToken).toBe("d009e9e9-ae45-48a7-80dd-64d92a6641a2");
    // Make sure we haven't accidentally exposed the snake_case key too.
    expect((result as unknown as Record<string, unknown>).access_token).toBeUndefined();
  });

  it("preserves order id and name verbatim", () => {
    const result = normalizeOrderSummary(orderCreateResponse);
    expect(result.id).toBe(5);
    expect(result.name).toBe("S00005");
    expect(result.state).toBe("draft");
  });
});

describe("normalizeOrderDetail", () => {
  it("flattens contact.name and contact.email to top-level fields", () => {
    const result = normalizeOrderDetail(orderDetail);
    expect(result.contactName).toBe("Test User");
    expect(result.contactEmail).toBe("test@goldberry.local");
  });

  it("renames each line's snake_case fields to camelCase", () => {
    const result = normalizeOrderDetail(orderDetail);
    expect(result.lines[0]).toMatchObject({
      productName: "Honeycrisp Apple Tree (3 gal, Nursery Pot)",
      unitPrice: 38.0,
      totalPrice: 38.0,
    });
  });
});
