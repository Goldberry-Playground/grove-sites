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

/** Raw variant from the product detail endpoint. */
export interface ApiVariant {
  id: number;
  /** Variant display name including attribute values (e.g. "Apple Tree (3 gal, Pot)"). */
  display_name: string;
  default_code: string | false;
  lst_price: number;
  /** Only present when the Odoo `stock` module is installed. */
  qty_available?: number;
  image_url: string;
}

/** Raw product detail from /grove/api/v1/products/:id. */
export interface ApiProductDetail extends ApiProductListItem {
  description_sale: string | false;
  grove_seo_description: string | false;
  categ_id: ApiMany2One | false;
  currency_id: ApiMany2One | false;
  /** Only present when the Odoo `stock` module is installed. */
  qty_available?: number;
  website_url: string | false;
  variants: ApiVariant[];
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
}

export interface ProductVariant {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  available: boolean;
  imageUrl: string;
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
