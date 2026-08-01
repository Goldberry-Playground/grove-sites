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
  ApiCheckoutSessionResponse,
} from "../types";

export const honeycrispListItem: ApiProductListItem = {
  id: 2,
  name: "Honeycrisp Apple Tree",
  slug: "honeycrisp-apple-tree",
  list_price: 38.0,
  default_code: "TREE-HONEYCRISP",
  website_published: true,
  grove_featured: false,
  image_url: "/web/image/product.template/2/image_128",
  tags: [
    { id: 11, name: "apple" },
    { id: 12, name: "pollinator-required" },
  ],
  categories: [{ id: 2, name: "Trees", slug: "trees" }],
  variant_count: 2,
  // One Honeycrisp cultivar × Potted/Bareroot Format = 2 variants, 1 variety.
  cultivar_count: 1,
  // Bareroot is the cheaper Format, so price_min < list_price.
  price_min: 32.0,
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
  // Detail endpoint returns `grove_slug` (not the list endpoint's `slug`).
  // Verified live against QA Odoo (GOL-400). normalizeProductDetail reads
  // `slug ?? grove_slug`, so this exercises the real fallback path.
  grove_slug: "honeycrisp-apple-tree",
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
      sku: false,
      cultivar: "Honeycrisp",
      format: "Nursery Pot",
      price: 38.0,
      qty_available: 5,
      shipping_tier: "potted",
      image_url: "/web/image/product.product/2/image_128",
    },
    {
      id: 3,
      display_name: "Honeycrisp Apple Tree (Bareroot)",
      sku: false,
      cultivar: "Honeycrisp",
      format: "Bareroot",
      price: 32.0,
      qty_available: 5,
      shipping_tier: "bareroot",
      image_url: "/web/image/product.product/3/image_128",
    },
  ],
  facts: {
    botanical_name: "Malus domestica 'Honeycrisp'",
    zone_min: 3,
    zone_max: 7,
    layer: "canopy",
    sun: "full",
    mature_size: "14–18 ft",
    spacing: "15 ft",
    soil: "Well-drained loam",
  },
  tags: [
    { id: 11, name: "apple" },
    { id: 12, name: "pollinator-required" },
  ],
  categories: [{ id: 2, name: "Trees", slug: "trees" }],
  images: [
    {
      id: 0,
      url: "/web/image/product.template/2/image_1024",
      thumb_url: "/web/image/product.template/2/image_256",
    },
    {
      id: 5,
      url: "/web/image/product.image/5/image_1024",
      thumb_url: "/web/image/product.image/5/image_256",
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

export const checkoutSessionResponse: ApiCheckoutSessionResponse = {
  session_id: "cs_test_a1b2c3",
  checkout_url: "https://checkout.stripe.com/c/pay/cs_test_a1b2c3",
  order_id: 5,
  order_ref: "S00005",
  access_token: "d009e9e9-ae45-48a7-80dd-64d92a6641a2",
  has_preorder: true,
  amount_due_today: 15.7,
  amount_total: 43.7,
  currency: "USD",
  // Mixed cart: an in-stock unit charged in full, a per-unit deposit for the
  // short unit, shipping, and WV tax on the goods billed today. The four lines
  // sum to amount_due_today (8.00 + 5.00 + 2.00 + 0.70 = 15.70).
  line_items: [
    { name: "Pawpaw 'Shenandoah'", kind: "goods", unit_amount: 8.0, quantity: 1 },
    { name: "Deposit — Persimmon 'Prok'", kind: "deposit", unit_amount: 5.0, quantity: 1 },
    { name: "Shipping", kind: "shipping", unit_amount: 2.0, quantity: 1 },
    { name: "Sales tax (WV)", kind: "tax", unit_amount: 0.7, quantity: 1 },
  ],
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
