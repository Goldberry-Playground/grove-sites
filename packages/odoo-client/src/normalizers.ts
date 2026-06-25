// Pure normalizers — translate the grove_headless REST API's wire shape
// into the React-facing types defined in ./types.
//
// These are extracted from client.ts so they can be unit-tested without
// the fetch wrapper. Every UI bug class we've hit so far (qty_available
// missing, currency_id false, variant display_name) routes through here
// — high ROI for tests.

import type {
  ApiProductListItem,
  ApiProductDetail,
  ApiCartResponse,
  ApiOrderCreateResponse,
  ApiOrderDetail,
  Product,
  ProductVariant,
  Cart,
  CartItem,
  OrderSummary,
  OrderDetail,
} from "./types";

export function normalizeProductListItem(raw: ApiProductListItem): Product {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    sku: raw.default_code || null,
    description: null,
    seoDescription: null,
    price: raw.list_price,
    currency: null,
    imageUrl: raw.image_url,
    categoryId: null,
    categoryName: null,
    // TODO(odoo): populate from raw.product_tag_ids once grove_headless exposes
    // it. Currently the list endpoint doesn't return tags — they come from
    // mock-products until the backend is wired.
    tags: [],
    available: raw.website_published,
    featured: raw.grove_featured,
    variants: [],
  };
}

export function normalizeProductDetail(raw: ApiProductDetail): Product {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    sku: raw.default_code || null,
    description: raw.description_sale || null,
    seoDescription: raw.grove_seo_description || null,
    price: raw.list_price,
    currency: raw.currency_id ? raw.currency_id.name : null,
    imageUrl: raw.image_url,
    categoryId: raw.categ_id ? raw.categ_id.id : null,
    categoryName: raw.categ_id ? raw.categ_id.name : null,
    // TODO(odoo): populate from raw.product_tag_ids once grove_headless exposes it.
    tags: [],
    // qty_available is only present when the Odoo `stock` module is installed.
    // Fall back to the parent product's website_published flag so the page
    // still distinguishes "out of stock" from "we don't track stock at all".
    available: raw.qty_available === undefined ? raw.website_published : raw.qty_available > 0,
    featured: raw.grove_featured,
    variants: (raw.variants ?? []).map(normalizeVariant),
  };
}

export function normalizeVariant(raw: ApiProductDetail["variants"][number]): ProductVariant {
  return {
    id: raw.id,
    name: raw.display_name,
    sku: raw.default_code || null,
    price: raw.lst_price,
    // Same fallback story as normalizeProductDetail — see comment there.
    available: raw.qty_available === undefined ? true : raw.qty_available > 0,
    imageUrl: raw.image_url,
  };
}

export function normalizeCart(raw: ApiCartResponse): Cart {
  return {
    id: raw.id ?? null,
    items: raw.lines.map(normalizeCartItem),
    subtotal: raw.amount_untaxed ?? 0,
    tax: raw.amount_tax ?? 0,
    total: raw.amount_total,
    currency: raw.currency?.name ?? null,
  };
}

export function normalizeCartItem(raw: ApiCartResponse["lines"][number]): CartItem {
  return {
    id: raw.id,
    productId: raw.product_id,
    name: raw.product_name,
    quantity: raw.quantity,
    unitPrice: raw.price_unit,
    totalPrice: raw.price_subtotal,
    imageUrl: raw.image_url,
  };
}

export function normalizeOrderSummary(raw: ApiOrderCreateResponse): OrderSummary {
  return {
    id: raw.id,
    name: raw.name,
    state: raw.state,
    accessToken: raw.access_token,
    amountUntaxed: raw.amount_untaxed,
    amountTax: raw.amount_tax,
    amountTotal: raw.amount_total,
    currency: raw.currency.name,
    lineCount: raw.line_count,
  };
}

export function normalizeOrderDetail(raw: ApiOrderDetail): OrderDetail {
  return {
    id: raw.id,
    name: raw.name,
    state: raw.state,
    contactName: raw.contact.name,
    contactEmail: raw.contact.email,
    lines: raw.lines.map((line) => ({
      id: line.id,
      productName: line.product_name,
      quantity: line.quantity,
      unitPrice: line.price_unit,
      totalPrice: line.price_subtotal,
    })),
    amountUntaxed: raw.amount_untaxed,
    amountTax: raw.amount_tax,
    amountTotal: raw.amount_total,
    currency: raw.currency.name,
  };
}
