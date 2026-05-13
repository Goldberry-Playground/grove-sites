// Recorded API responses captured against the live grove_headless endpoint
// during Sprint 2 testing. Used as fixtures for normalizer tests so the
// test inputs match what production really sees, not what types alone
// would allow.

import type {
  ApiProductListItem,
  ApiProductListResponse,
  ApiProductDetail,
  ApiCartResponse,
  ApiOrderCreateResponse,
  ApiOrderDetail,
} from "../types";

export const honeycrispListItem: ApiProductListItem = {
  id: 2,
  name: "Honeycrisp Apple Tree",
  list_price: 38.0,
  default_code: "TREE-HONEYCRISP",
  website_published: true,
  grove_featured: false,
  image_url: "/web/image/product.template/2/image_128",
};

export const productListResponse: ApiProductListResponse = {
  count: 5,
  limit: 40,
  offset: 0,
  results: [honeycrispListItem],
};

// Product detail WITHOUT stock module installed — qty_available absent.
// This is the production state today. The normalizer should treat absent
// qty_available as "we don't track stock — fall back to website_published".
export const honeycrispDetail: ApiProductDetail = {
  id: 2,
  name: "Honeycrisp Apple Tree",
  list_price: 38.0,
  default_code: "TREE-HONEYCRISP",
  website_published: true,
  grove_featured: false,
  image_url: "/web/image/product.template/2/image_1920",
  description_sale:
    "Cold-hardy semi-dwarf apple tree, prized for sweet-tart fruit and " +
    "exceptional storage life. Ripens late September. Pollinator required.",
  grove_seo_description: false,
  categ_id: { id: 8, name: "Plants / Trees" },
  currency_id: { id: 1, name: "USD" },
  website_url: "/shop/tree-honeycrisp-honeycrisp-apple-tree-2",
  variants: [
    {
      id: 2,
      display_name: "Honeycrisp Apple Tree (3 gal, Nursery Pot)",
      default_code: false,
      lst_price: 38.0,
      image_url: "/web/image/product.product/2/image_128",
    },
    {
      id: 3,
      display_name: "Honeycrisp Apple Tree (3 gal, Burlap Ball)",
      default_code: false,
      lst_price: 38.0,
      image_url: "/web/image/product.product/3/image_128",
    },
  ],
};

// Same product with stock module installed — qty_available present.
export const honeycrispDetailWithStock: ApiProductDetail = {
  ...honeycrispDetail,
  qty_available: 12,
  variants: honeycrispDetail.variants.map((v, i) => ({
    ...v,
    qty_available: i === 0 ? 8 : 0, // first variant in stock, second sold out
  })),
};

// Edge case: Odoo returns `false` (not null) for unset many2one fields.
export const honeycrispWithMissingFields: ApiProductDetail = {
  ...honeycrispDetail,
  description_sale: false as unknown as string,
  default_code: false,
  categ_id: false as unknown as { id: number; name: string },
  currency_id: false as unknown as { id: number; name: string },
};

export const emptyCart: ApiCartResponse = {
  lines: [],
  amount_total: 0,
  currency: null,
};

export const cartWithOneLine: ApiCartResponse = {
  id: 1,
  lines: [
    {
      id: 1,
      product_id: 2,
      product_name: "Honeycrisp Apple Tree (3 gal, Nursery Pot)",
      quantity: 1,
      price_unit: 38.0,
      price_subtotal: 38.0,
      image_url: "/web/image/product.product/2/image_128",
    },
  ],
  amount_untaxed: 38.0,
  amount_tax: 5.7,
  amount_total: 43.7,
  currency: { id: 1, name: "USD" },
};

export const orderCreateResponse: ApiOrderCreateResponse = {
  id: 5,
  name: "S00005",
  state: "draft",
  access_token: "d009e9e9-ae45-48a7-80dd-64d92a6641a2",
  amount_untaxed: 38.0,
  amount_tax: 5.7,
  amount_total: 43.7,
  currency: { id: 1, name: "USD" },
  line_count: 1,
};

export const orderDetail: ApiOrderDetail = {
  id: 5,
  name: "S00005",
  state: "draft",
  contact: { name: "Test User", email: "test@goldberry.local" },
  lines: [
    {
      id: 7,
      product_name: "Honeycrisp Apple Tree (3 gal, Nursery Pot)",
      quantity: 1.0,
      price_unit: 38.0,
      price_subtotal: 38.0,
    },
  ],
  amount_untaxed: 38.0,
  amount_tax: 5.7,
  amount_total: 43.7,
  currency: { id: 1, name: "USD" },
};
