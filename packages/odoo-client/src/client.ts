import type {
  TenantConfig,
  Product,
  ProductVariant,
  ProductListResult,
  Cart,
  CartItem,
  OdooClient,
  ApiProductListResponse,
  ApiProductListItem,
  ApiProductDetail,
  ApiCartResponse,
  OrderCreateInput,
  OrderSummary,
  OrderDetail,
  ApiOrderCreateResponse,
  ApiOrderDetail,
} from "./types";

/**
 * Fetch from the grove_headless REST API.
 * All endpoints are plain HTTP JSON (not Odoo JSON-RPC).
 */
async function api<T>(
  config: TenantConfig,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.odooUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Grove-Tenant": config.tenantId,
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Odoo API error: ${response.status} ${response.statusText} — ${body}`
    );
  }

  return response.json() as Promise<T>;
}

// ── Normalizers (API shape → client shape) ──────────────────────────

function normalizeProductListItem(raw: ApiProductListItem): Product {
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.default_code || null,
    description: null,
    seoDescription: null,
    price: raw.list_price,
    currency: null,
    imageUrl: raw.image_url,
    categoryId: null,
    categoryName: null,
    available: raw.website_published,
    featured: raw.grove_featured,
    variants: [],
  };
}

function normalizeProductDetail(raw: ApiProductDetail): Product {
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.default_code || null,
    description: raw.description_sale || null,
    seoDescription: raw.grove_seo_description || null,
    price: raw.list_price,
    currency: raw.currency_id ? raw.currency_id.name : null,
    imageUrl: raw.image_url,
    categoryId: raw.categ_id ? raw.categ_id.id : null,
    categoryName: raw.categ_id ? raw.categ_id.name : null,
    available: raw.qty_available === undefined ? raw.website_published : raw.qty_available > 0,
    featured: raw.grove_featured,
    variants: (raw.variants ?? []).map(normalizeVariant),
  };
}

function normalizeVariant(raw: ApiProductDetail["variants"][number]): ProductVariant {
  return {
    id: raw.id,
    name: raw.display_name,
    sku: raw.default_code || null,
    price: raw.lst_price,
    available: raw.qty_available === undefined ? true : raw.qty_available > 0,
    imageUrl: raw.image_url,
  };
}

function normalizeCart(raw: ApiCartResponse): Cart {
  return {
    id: raw.id ?? null,
    items: raw.lines.map(normalizeCartItem),
    subtotal: raw.amount_untaxed ?? 0,
    tax: raw.amount_tax ?? 0,
    total: raw.amount_total,
    currency: raw.currency?.name ?? null,
  };
}

function normalizeCartItem(raw: ApiCartResponse["lines"][number]): CartItem {
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

// ── Client factory ──────────────────────────────────────────────────

/**
 * Create a typed Odoo client for a specific tenant.
 * Calls the grove_headless REST API at /grove/api/v1/*.
 */
export function createOdooClient(config: TenantConfig): OdooClient {
  return {
    async health() {
      return api<{ status: string }>(config, "/grove/api/v1/health");
    },

    products: {
      async list(params) {
        const searchParams = new URLSearchParams();
        if (params?.categoryId) searchParams.set("category_id", String(params.categoryId));
        if (params?.featured) searchParams.set("featured", "1");
        if (params?.limit) searchParams.set("limit", String(params.limit));
        if (params?.offset) searchParams.set("offset", String(params.offset));

        const qs = searchParams.toString();
        const path = `/grove/api/v1/products${qs ? `?${qs}` : ""}`;
        const raw = await api<ApiProductListResponse>(config, path);

        return {
          count: raw.count,
          limit: raw.limit,
          offset: raw.offset,
          products: raw.results.map(normalizeProductListItem),
        };
      },

      async get(id) {
        const raw = await api<ApiProductDetail>(config, `/grove/api/v1/products/${id}`);
        return normalizeProductDetail(raw);
      },
    },

    cart: {
      async get() {
        const raw = await api<ApiCartResponse>(config, "/grove/api/v1/cart");
        return normalizeCart(raw);
      },

      async addItem(productId, quantity = 1) {
        const raw = await api<ApiCartResponse>(config, "/grove/api/v1/cart", {
          method: "POST",
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        return normalizeCart(raw);
      },
    },

    orders: {
      async create(input: OrderCreateInput): Promise<OrderSummary> {
        const raw = await api<ApiOrderCreateResponse>(
          config,
          "/grove/api/v1/orders",
          {
            method: "POST",
            body: JSON.stringify({
              contact: input.contact,
              shipping: input.shipping,
              billing: input.billing ?? null,
              payment_method: input.paymentMethod,
              items: input.items.map((i) => ({
                variant_id: i.variantId,
                quantity: i.quantity,
              })),
            }),
          }
        );
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
      },

      async get(id: number, accessToken: string): Promise<OrderDetail> {
        const params = new URLSearchParams({ access_token: accessToken });
        const raw = await api<ApiOrderDetail>(
          config,
          `/grove/api/v1/orders/${id}?${params.toString()}`
        );
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
      },
    },
  };
}
