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
  name: string;
  default_code: string | false;
  lst_price: number;
  qty_available: number;
  image_url: string;
}

/** Raw product detail from /grove/api/v1/products/:id. */
export interface ApiProductDetail extends ApiProductListItem {
  description_sale: string | false;
  grove_seo_description: string | false;
  categ_id: ApiMany2One | false;
  currency_id: ApiMany2One | false;
  qty_available: number;
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
  name: string;
  sku: string | null;
  description: string | null;
  seoDescription: string | null;
  price: number;
  currency: string | null;
  imageUrl: string;
  categoryId: number | null;
  categoryName: string | null;
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
  };
  cart: {
    get(): Promise<Cart>;
    addItem(productId: number, quantity?: number): Promise<Cart>;
  };
}
