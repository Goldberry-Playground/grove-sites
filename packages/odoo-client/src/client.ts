import type {
  TenantConfig,
  ProductListResult,
  Cart,
  OdooClient,
  ApiProductListResponse,
  ApiProductDetail,
  ApiCartResponse,
  OrderCreateInput,
  OrderSummary,
  OrderDetail,
  ApiOrderCreateResponse,
  ApiOrderDetail,
} from "./types";
import {
  normalizeProductListItem,
  normalizeProductDetail,
  normalizeCart,
  normalizeOrderSummary,
  normalizeOrderDetail,
} from "./normalizers";

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

// Normalizers live in ./normalizers — extracted there so they can be
// unit-tested without the fetch wrapper.


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

      async getBySlug(slug) {
        const params = new URLSearchParams({ slug });
        const raw = await api<ApiProductListResponse>(
          config,
          `/grove/api/v1/products?${params.toString()}`,
        );
        if (raw.results.length === 0) return null;
        // List response carries everything except variants[]. Re-fetch detail by id for
        // variants — hub product pages need them.
        const detail = await api<ApiProductDetail>(
          config,
          `/grove/api/v1/products/${raw.results[0].id}`,
        );
        return normalizeProductDetail(detail);
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
        return normalizeOrderSummary(raw);
      },

      async get(id: number, accessToken: string): Promise<OrderDetail> {
        const params = new URLSearchParams({ access_token: accessToken });
        const raw = await api<ApiOrderDetail>(
          config,
          `/grove/api/v1/orders/${id}?${params.toString()}`
        );
        return normalizeOrderDetail(raw);
      },
    },
  };
}
