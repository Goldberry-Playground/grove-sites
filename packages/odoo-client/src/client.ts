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
  ShippingRateFeed,
  ShippingCalendar,
  NewsletterSubscribeInput,
  NewsletterSubscribeResult,
  ApiNewsletterSubscribeResponse,
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

/** A `[month, day]` pair the calendar resolver can index into. */
function isMonthDay(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number";
}

/**
 * True only when the feed's `calendar` block carries every field the product
 * page's mode resolver dereferences (GOL-1313). The backend always serializes
 * these (`serialize_calendar`), so this guards against a hand-crafted or
 * partially-migrated feed rather than the normal path — but the resolver reads
 * `preorder_open.fall/.spring` unguarded, so a partial calendar must be rejected
 * at the boundary (→ degrade to snapshot) before it reaches React.
 */
function isWellFormedCalendar(cal: ShippingCalendar | undefined | null): cal is ShippingCalendar {
  return (
    !!cal &&
    typeof cal === "object" &&
    !!cal.preorder_open &&
    isMonthDay(cal.preorder_open.fall) &&
    isMonthDay(cal.preorder_open.spring) &&
    !!cal.zones &&
    typeof cal.zones === "object"
  );
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
        if (params?.tagId) searchParams.set("tag_id", String(params.tagId));
        if (params?.zone) searchParams.set("zone", String(params.zone));
        if (params?.layer) searchParams.set("layer", params.layer);
        if (params?.sun) searchParams.set("sun", params.sun);
        if (params?.limit) searchParams.set("limit", String(params.limit));
        if (params?.offset) searchParams.set("offset", String(params.offset));

        const qs = searchParams.toString();
        const path = `/grove/api/v1/products${qs ? `?${qs}` : ""}`;
        // Cache the browse fetch (GOL-1319). The catalog is small and changes at
        // most a few times a day, but /shop re-fetches the whole list on every
        // search, category-pill click, and `?all=1` reveal — a fresh full-catalog
        // round-trip to the single Odoo droplet per navigation. A short revalidate
        // collapses those into one shared Data Cache entry (per facet URL) while
        // the publish webhook's `revalidatePath('/shop')` still flushes it on a
        // new/edited product. (Callers on `force-dynamic` pages opt out of this
        // via Next's `force-no-store`; that's fine — they wanted per-request.)
        //
        // 30s, not 60 (GOL-1896): the `product.availability` webhook is the fast
        // path (sellout/restock reflected in ~5s); this ISR window is the safety
        // net for a missed or failed delivery, so it degrades to a 30s stale
        // window rather than the old minute. Don't drop it much lower — every
        // miss is a full-catalog fetch against the single Odoo droplet.
        const raw = await api<ApiProductListResponse>(config, path, {
          next: { revalidate: 30 },
        });

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
          // Box Engine v2 (schema 2) re-keys `zones` by box id, not ShippingTier.
          // A tier-keyed caller (resolveRateTable) would read every tier as
          // missing and price all green states to null — strictly worse than the
          // snapshot. So surface the table only for the legacy schema-1 feed; on
          // schema 2 return null and let the caller keep its snapshot until it
          // migrates to rateFeed(). (Wave 2 of GOL-1035.)
          if (raw?.schema && raw.schema >= 2) return null;
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
      async rateFeed(): Promise<ShippingRateFeed | null> {
        // Schema-2 Box Engine v2 feed (GOL-1038). Same endpoint + cache posture
        // as rates(); this accessor keeps the full typed payload (box-keyed
        // zones + packing catalog) instead of collapsing to the legacy table.
        try {
          const raw = await api<ShippingRateFeed>(
            config,
            "/grove/api/v1/shipping/rates",
            { next: { revalidate: 21600 } }
          );
          // Only a well-formed schema-2 feed is usable as a box feed. A schema-1
          // feed (Odoo not yet upgraded) has no `packing` and tier-keyed zones,
          // an empty table means "not configured", and an unreachable feed throws
          // below — every case returns null so the caller keeps its snapshot.
          //
          // The `calendar` block is validated too (GOL-1313): the product page's
          // mode resolver dereferences `calendar.preorder_open.fall/.spring`, so a
          // schema-2 feed whose calendar is absent or partial would crash
          // ProductView's useMemo. Reject it here and degrade to the snapshot
          // (shipMode → null → the legacy static bareroot hint) rather than break
          // every nursery product page.
          if (
            !raw ||
            (raw.schema ?? 1) < 2 ||
            !raw.packing ||
            !raw.zones ||
            Object.keys(raw.zones).length === 0 ||
            !isWellFormedCalendar(raw.calendar)
          ) {
            return null;
          }
          return raw;
        } catch {
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
              fulfillment: input.fulfillment,
              promo_code: input.promoCode,
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
              fulfillment: input.fulfillment,
              promo_code: input.promoCode,
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

    newsletter: {
      async subscribe(
        input: NewsletterSubscribeInput
      ): Promise<NewsletterSubscribeResult> {
        const body: Record<string, unknown> = {
          email: input.email,
          brand: input.brand,
          interests: input.interests ?? [],
          source: input.source,
          // Consent is validated upstream; the endpoint re-checks it as opt-in
          // proof and 400s without a truthy value.
          consent: input.consent,
        };
        if (input.name) body.name = input.name;
        if (input.attribution) body.attribution = input.attribution;

        const raw = await api<ApiNewsletterSubscribeResponse>(
          config,
          "/grove/api/v1/newsletter/subscribe",
          { method: "POST", body: JSON.stringify(body) }
        );
        return {
          partnerId: raw.partner_id != null ? String(raw.partner_id) : undefined,
          created: raw.created,
        };
      },
    },
  };
}
