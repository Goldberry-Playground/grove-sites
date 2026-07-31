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
  CheckoutSessionInput,
  CheckoutSession,
  ApiCheckoutSessionResponse,
  ApiZoneResponse,
  ZoneLookupResult,
  ApiShippingRatesResponse,
  ShippingRateTable,
} from "./types";
import {
  normalizeProductListItem,
  normalizeProductDetail,
  normalizeCart,
  normalizeOrderSummary,
  normalizeOrderDetail,
  normalizeCheckoutSession,
  normalizeZone,
} from "./normalizers";

/** Thrown when the grove_headless API returns a non-2xx status. Carries the
 * HTTP `status` so callers can branch on it — e.g. the ZIP→zone lookup treats
 * 404 as "unknown ZIP" (null) rather than a hard failure. `body` is the raw
 * response text so a caller can recover the backend's `{ "error": … }` payload
 * (the checkout route forwards friendly 4xx/409 stock/potted messages) without
 * re-parsing it out of the composed `message`. */
export class OdooApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body = ""
  ) {
    super(message);
    this.name = "OdooApiError";
  }
}

/** `RequestInit` plus Next.js's `next` cache directive. Declared locally so this
 * framework-agnostic package can request ISR-style revalidation without taking
 * a dependency on `next` — the field is a plain extra property that a non-Next
 * `fetch` simply ignores. */
type NextFetchOptions = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

/**
 * Fetch from the grove_headless REST API.
 * All endpoints are plain HTTP JSON (not Odoo JSON-RPC).
 */
async function api<T>(
  config: TenantConfig,
  path: string,
  options: NextFetchOptions = {}
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
    throw new OdooApiError(
      response.status,
      `Odoo API error: ${response.status} ${response.statusText} — ${body}`,
      body
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
        if (params?.tagId) searchParams.set("tag_id", String(params.tagId));
        if (params?.zone) searchParams.set("zone", String(params.zone));
        if (params?.layer) searchParams.set("layer", params.layer);
        if (params?.sun) searchParams.set("sun", params.sun);
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

    async zone(zip): Promise<ZoneLookupResult | null> {
      // Guard client-side so a blank/partial ZIP never round-trips (the widget
      // calls this on every keystroke). The API only knows 5-digit US ZIPs.
      const trimmed = String(zip ?? "").trim();
      if (!/^\d{5}$/.test(trimmed)) return null;

      const params = new URLSearchParams({ zip: trimmed });
      try {
        const raw = await api<ApiZoneResponse>(
          config,
          `/grove/api/v1/zone?${params.toString()}`
        );
        return normalizeZone(raw);
      } catch (err) {
        // A ZIP outside the USDA matrix 404s — a normal "we don't cover that
        // ZIP" answer, not a failure. Re-throw anything else (network/5xx).
        if (err instanceof OdooApiError && err.status === 404) return null;
        throw err;
      }
    },

    shipping: {
      async rates(): Promise<ShippingRateTable | null> {
        // Read-only feed (GOL-952). Cache reasonably: the backend rate-checker
        // rewrites the table at most daily, so a 6-hour revalidate keeps the
        // storefront estimate fresh without hammering Odoo on every product view.
        try {
          const raw = await api<ApiShippingRatesResponse>(
            config,
            "/grove/api/v1/shipping/rates",
            { next: { revalidate: 21600 } }
          );
          const zones = raw?.zones;
          // Empty/absent table → null so the caller's resolveRateTable() falls
          // back to the bundled snapshot rather than pricing everything to null.
          return zones && Object.keys(zones).length > 0 ? zones : null;
        } catch {
          // Feed unreachable (network / 5xx / not-configured): degrade to the
          // bundled snapshot. A missing rate feed must never break a product page.
          return null;
        }
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

    checkout: {
      async createSession(
        input: CheckoutSessionInput
      ): Promise<CheckoutSession> {
        const raw = await api<ApiCheckoutSessionResponse>(
          config,
          "/grove/api/v1/checkout/session",
          {
            method: "POST",
            body: JSON.stringify({
              contact: input.contact,
              shipping: input.shipping,
              billing: input.billing ?? null,
              payment_method: input.paymentMethod,
              success_url: input.successUrl,
              cancel_url: input.cancelUrl,
              items: input.items.map((i) => ({
                variant_id: i.variantId,
                quantity: i.quantity,
              })),
            }),
          }
        );
        return normalizeCheckoutSession(raw);
      },
    },
  };
}
