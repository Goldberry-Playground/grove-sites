/** Connection config for a single tenant's Odoo instance. */
export interface TenantConfig {
  /** Identifier for this tenant (e.g., "goldberry", "ggg", "nursery"). */
  tenantId: string;
  /** Base URL of the Odoo instance (e.g., "http://localhost:8069"). */
  odooUrl: string;
  /** Optional API key for authenticated endpoints (Bearer token). */
  apiKey?: string;
}

// ── API response types (match grove_headless controller output) ─────

/** Tag entry from the catalog API — `product.template.product_tag_ids`. */
export interface ApiTag {
  id: number;
  name: string;
}

/** Raw product from the /grove/api/v1/products list endpoint. */
export interface ApiProductListItem {
  id: number;
  name: string;
  slug: string;
  list_price: number;
  default_code: string | false;
  website_published: boolean;
  grove_featured: boolean;
  image_url: string;
  /** Cross-cutting tags (catalog API v1). Powers the /shop facet sidebar. */
  tags: ApiTag[];
  /** Number of purchasable variants (catalog API v1). */
  variant_count: number;
  /** Lowest variant list price — the "from $X" card price (catalog API v1). */
  price_min: number;
}

/** Paginated product list response. */
export interface ApiProductListResponse {
  count: number;
  limit: number;
  offset: number;
  results: ApiProductListItem[];
}

/** Many2one field shape from Odoo serialization. */
export interface ApiMany2One {
  id: number;
  name: string;
}

/** Effective per-variant shipping tier — bareroot ships as a slim box, potted
 * as a heavy box, so a bareroot Format variant must not quote potted rates
 * (resolved server-side in grove_headless, catalog API v1). */
export type ShippingTier = "bareroot" | "potted";

/** Raw structured variant from the product detail endpoint (catalog API v1).
 *
 * ⚠️ Wire change: pre-v1 this returned `default_code`/`lst_price` (a bare
 * `variant.read()`). v1 returns a purpose-built shape with attribute axes
 * parsed into `cultivar`/`format`, `sku`/`price` renamed, and the effective
 * `shipping_tier`. `qty_available` is always present — `stock` is a hard
 * dependency of grove_headless.
 */
export interface ApiVariant {
  id: number;
  /** Variant display name including attribute values (e.g. "Apple Tree (3 gal, Pot)"). */
  display_name: string;
  sku: string | false;
  /** Cultivar axis value, "" when the product has no Cultivar attribute. */
  cultivar: string;
  /** Format axis value (e.g. "Potted", "Bareroot"), "" when absent. */
  format: string;
  price: number;
  qty_available: number;
  /** Selection field: `false` only if the compute somehow yielded no tier. */
  shipping_tier: ShippingTier | false;
  image_url: string;
}

/** Gallery image from the product detail endpoint (catalog API v1). */
export interface ApiProductImage {
  id: number;
  url: string;
  thumb_url: string;
}

/** Growing-facts block from the product detail endpoint (catalog API v1).
 * Filterable facts are typed; display-only facts are strings ("" when unset). */
export interface ApiFacts {
  botanical_name: string;
  zone_min: number | null;
  zone_max: number | null;
  layer: string;
  sun: string;
  mature_size: string;
  spacing: string;
  soil: string;
}

/** Raw product detail from /grove/api/v1/products/:id.
 *
 * ⚠️ Wire asymmetry: the list endpoint aliases the Odoo `grove_slug` field to
 * `slug`, but the detail endpoint does NOT — it returns the canonical
 * `grove_slug` and omits `slug` entirely (verified live against QA Odoo,
 * id 173/174). So `slug` is optional here and `grove_slug` is the source of
 * truth; the normalizer reads `slug ?? grove_slug` (see normalizeProductDetail).
 */
export interface ApiProductDetail
  extends Omit<ApiProductListItem, "slug" | "tags" | "variant_count" | "price_min"> {
  /** Present on the list endpoint; absent on the detail endpoint. */
  slug?: string;
  /** Canonical Odoo slug — always returned by the detail endpoint. */
  grove_slug: string;
  description_sale: string | false;
  grove_seo_description: string | false;
  categ_id: ApiMany2One | false;
  currency_id: ApiMany2One | false;
  /** Only present when the Odoo `stock` module is installed. */
  qty_available?: number;
  website_url: string | false;
  variants: ApiVariant[];
  /** Growing-facts block (catalog API v1). */
  facts: ApiFacts;
  /** Cross-cutting tags (catalog API v1). */
  tags: ApiTag[];
  /** Ordered gallery: template hero first, then eCommerce media (catalog API v1). */
  images: ApiProductImage[];
}

/** Cart line from /grove/api/v1/cart. */
export interface ApiCartLine {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price_unit: number;
  price_subtotal: number;
  image_url: string;
}

/** Cart response from /grove/api/v1/cart. */
export interface ApiCartResponse {
  id?: number;
  lines: ApiCartLine[];
  amount_untaxed?: number;
  amount_tax?: number;
  amount_total: number;
  currency: ApiMany2One | null;
}

// ── Normalized types (used by React components) ─────────────────────

export interface Product {
  id: number;
  slug: string;
  name: string;
  sku: string | null;
  description: string | null;
  seoDescription: string | null;
  price: number;
  currency: string | null;
  imageUrl: string;
  categoryId: number | null;
  categoryName: string | null;
  /**
   * Cross-cutting category tags (e.g. "apple", "bare-root", "cold-strat").
   * Lets a product belong to multiple categories — distinct from the single
   * `categoryId`/`categoryName` (the Odoo product.category, plant-type only).
   *
   * Sourced from Odoo's `product.template.product_tag_ids` field once the
   * grove_headless module exposes it. Until then the value comes from
   * mock-products.ts (per-tenant). Filter logic lives in each app's
   * data/categories.ts — slug → tag matcher → optional Odoo tag IDs.
   *
   * Optional so per-tenant mockProducts don't have to specify it everywhere;
   * the nursery uses it for filtering, the other tenants (goldberry, ggg, hub)
   * can ignore it until they need cross-cutting categorization too.
   */
  tags?: string[];
  available: boolean;
  featured: boolean;
  variants: ProductVariant[];
  /**
   * Lowest variant price — the "from $X" price shown on shop cards. Present on
   * list-endpoint products; undefined for mockProducts and detail fetches that
   * carry the full variant array (derive from `variants` there instead).
   */
  priceMin?: number;
  /** Purchasable variant count (list endpoint). Undefined for mockProducts. */
  variantCount?: number;
  /** Growing-facts block (detail endpoint). Undefined on list items/mocks. */
  facts?: GrowingFacts;
  /** Ordered gallery (detail endpoint). Undefined on list items/mocks. */
  images?: ProductImage[];
}

export interface ProductVariant {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  available: boolean;
  imageUrl: string;
  /** Cultivar axis value (e.g. "Honeycrisp"); null when the product has none. */
  cultivar?: string | null;
  /** Format axis value (e.g. "Potted", "Bareroot"); null when absent. */
  format?: string | null;
  /** Effective shipping tier — drives the Potted/Bareroot landed-cost delta. */
  shippingTier?: ShippingTier | null;
  /**
   * Exact on-hand quantity for the "N in stock" display. null when the payload
   * omits qty_available (older API) — render the boolean `available` state only
   * rather than a misleading count.
   */
  qtyAvailable?: number | null;
}

/** Filterable + display growing facts, normalized from the detail endpoint. */
export interface GrowingFacts {
  botanicalName: string | null;
  zoneMin: number | null;
  zoneMax: number | null;
  layer: string | null;
  sun: string | null;
  matureSize: string | null;
  spacing: string | null;
  soil: string | null;
}

/** A single gallery image with full and thumbnail URLs. */
export interface ProductImage {
  id: number;
  url: string;
  thumbUrl: string;
}

export interface ProductListResult {
  count: number;
  limit: number;
  offset: number;
  products: Product[];
}

export interface CartItem {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl: string;
}

export interface Cart {
  id: number | null;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string | null;
}

// ── Orders ──────────────────────────────────────────────────────────

export interface Address {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
}

export interface OrderItemInput {
  variantId: number;
  quantity: number;
}

export interface OrderCreateInput {
  contact: Contact;
  shipping: Address;
  /** Omit or null when billing address matches shipping. */
  billing?: Address | null;
  /** Informational — real payment integration lands in a later sprint. */
  paymentMethod?: string;
  items: OrderItemInput[];
}

/** Raw order response from POST /grove/api/v1/orders. */
export interface ApiOrderCreateResponse {
  id: number;
  name: string;
  state: string;
  access_token: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency: ApiMany2One;
  line_count: number;
}

/** Raw order detail from GET /grove/api/v1/orders/:id. */
export interface ApiOrderDetail {
  id: number;
  name: string;
  state: string;
  contact: { name: string; email: string };
  lines: Array<{
    id: number;
    product_name: string;
    quantity: number;
    price_unit: number;
    price_subtotal: number;
  }>;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  currency: ApiMany2One;
}

export interface OrderSummary {
  id: number;
  name: string;
  state: string;
  /** Server-issued token. Required to fetch this order's details — pass to orders.get(). */
  accessToken: string;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  currency: string;
  lineCount: number;
}

export interface OrderLine {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDetail {
  id: number;
  name: string;
  state: string;
  contactName: string;
  contactEmail: string;
  lines: OrderLine[];
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  currency: string;
}

export interface OdooClient {
  health(): Promise<{ status: string }>;
  products: {
    list(params?: {
      categoryId?: number;
      featured?: boolean;
      /** Filter by a single tag id (catalog API v1 `tag_id`). */
      tagId?: number;
      /** USDA zone — returns products whose zone_min..zone_max spans it. */
      zone?: number;
      limit?: number;
      offset?: number;
    }): Promise<ProductListResult>;
    get(id: number): Promise<Product>;
    getBySlug(slug: string): Promise<Product | null>;
  };
  cart: {
    get(): Promise<Cart>;
    addItem(productId: number, quantity?: number): Promise<Cart>;
  };
  orders: {
    create(input: OrderCreateInput): Promise<OrderSummary>;
    get(id: number, accessToken: string): Promise<OrderDetail>;
  };
}
