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

/** Website (public) category from the catalog API — the storefront's plant-type
 * browse taxonomy (Trees/Shrubs/Vines). `slug` is the stable URL twin of `id`,
 * used by the /shop cat-bar (`?cat=<slug>`). */
export interface ApiCategory {
  id: number;
  name: string;
  slug: string;
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
  image_url: string | null;
  /**
   * Odoo's `image_128` field — base64 of the stored photo when one is set,
   * `false` when the product has no image. This is the authoritative "has a
   * real photo" signal: `image_url` is always a non-empty path even for
   * imageless products (Odoo then serves its own gray placeholder at HTTP 200,
   * indistinguishable from a real image), so the normalizer reads `image_128`
   * to decide whether to show the branded botanical placeholder (GOL-680).
   * Optional so older/partial payloads that omit it fall back to showing the
   * URL. Inherited by ApiProductDetail.
   */
  image_128?: string | false | null;
  /** Cross-cutting tags (catalog API v1). Powers the /shop facet sidebar. */
  tags: ApiTag[];
  /** Website (public) categories — the plant-type browse taxonomy that drives
   * the /shop cat-bar. Empty until the product is filed under a website
   * category in Odoo. */
  categories: ApiCategory[];
  /** Number of purchasable variants (catalog API v1). */
  variant_count: number;
  /**
   * Distinct cultivar count — the storefront "N varieties" figure (GOL-919).
   * A single-cultivar plant with a Potted/Bareroot Format axis has two
   * `variant_count` but is one variety, so the card must key its count on this
   * (cultivars), not the Cultivar × Format variant grid. Optional so mocks and
   * pre-GOL-919 payloads that omit it fall back to `variant_count`.
   */
  cultivar_count?: number;
  /** Lowest variant list price — the "from $X" card price (catalog API v1). */
  price_min: number;
  /**
   * Purchasability flag (grove-odoo-modules GOL-760). `false` on a published-
   * but-not-for-sale "coming soon" placeholder — the product still appears in
   * the grid and `?cat=` facets, but the card renders as coming-soon (not
   * purchasable). Optional so mocks and older payloads that omit it stay
   * purchasable.
   */
  sale_ok?: boolean;
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
  /** Rootstock / propagation axis value (e.g. "M.111", "Seedling"), "" or
   *  absent when the product has no Rootstock attribute (GOL-1112). Optional so
   *  payloads from an endpoint that predates the axis parse still validate. */
  rootstock?: string;
  price: number;
  qty_available: number;
  /** Selection field: `false` only if the compute somehow yielded no tier. */
  shipping_tier: ShippingTier | false;
  image_url: string | null;
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
  /**
   * eCommerce Description HTML (Odoo `website_description`) — the single source
   * of truth for guide prose under publish-pipeline v2 (vault: "Grove
   * publish-pipeline design", 2026-07-26; GOL-1012 / grove-sites#341). `false`
   * or "" when unset. Optional so a payload from a grove_headless build that
   * predates the field (grove-odoo-modules PR A / GOL-888) doesn't break.
   */
  website_description?: string | false;
  /**
   * Two-tier guide gate (Odoo `grove_guide_ready`, grove-odoo-modules PR A /
   * GOL-888). Only when true should the storefront render `website_description`
   * as the plant guide; false/absent → no guide yet ("coming soon"). Optional so
   * older payloads gate closed by default.
   */
  grove_guide_ready?: boolean;
  categ_id: ApiMany2One | false;
  currency_id: ApiMany2One | false;
  /** Only present when the Odoo `stock` module is installed. */
  qty_available?: number;
  // `sale_ok` is inherited from ApiProductListItem — the detail endpoint has
  // served it since grove-odoo-modules #47/#48; the list endpoint since GOL-760.
  website_url: string | false;
  variants: ApiVariant[];
  /** Growing-facts block (catalog API v1). */
  facts: ApiFacts;
  /** Cross-cutting tags (catalog API v1). */
  tags: ApiTag[];
  /** Ordered gallery: template hero first, then eCommerce media (catalog API v1). */
  images: ApiProductImage[];
}

/** Raw response from GET /grove/api/v1/zone?zip= (catalog API v1). The
 * endpoint 404s for a ZIP outside the USDA matrix — the client maps that to
 * `null` rather than surfacing it as an error. */
export interface ApiZoneResponse {
  zip: string;
  zone: number;
}

/** A per-zone, per-tier shipping rate. Mirrors one entry of grove_headless
 * `data/shipping_rates.json`; `base` is the per-tree charge in dollars. */
export interface ShippingZoneTierRate {
  base: number;
}

/** Zone id → tier → rate, the `zones` map from GET /grove/api/v1/shipping/rates.
 * Structurally identical to the storefront estimator's `RateTable`
 * (`apps/nursery/lib/shipping-estimate.ts`) so a fetched table drops straight
 * into `resolveRateTable()` and overrides the bundled snapshot. */
export type ShippingRateTable = Record<
  string,
  Partial<Record<ShippingTier, ShippingZoneTierRate>>
>;

/** Raw response from GET /grove/api/v1/shipping/rates — grove_headless
 * `rate_feed()` (GOL-952, schema 1). A read-only snapshot of the tier-keyed
 * rate table plus the compliance zone map the backend prices checkout with.
 *
 * Superseded by the schema-2 Box Engine v2 feed ({@link ShippingRateFeed},
 * grove-odoo-modules #60): the same endpoint now returns `schema: 2`, box-keyed
 * `zones`, and a `packing` catalog. The legacy `shipping.rates()` accessor still
 * consumes this shape for a not-yet-upgraded Odoo, and returns null once it sees
 * `schema >= 2` so a tier-keyed caller falls back to its snapshot rather than
 * reading every box id as a missing tier. */
export interface ApiShippingRatesResponse {
  zones: ShippingRateTable;
  zone_by_state: Record<string, string>;
  green_states: string[];
  /** Present from Box Engine v2 (schema 2); absent on the legacy schema-1 feed. */
  schema?: number;
}

// ── Schema-2 rate feed — Box Engine v2 (GOL-1038) ───────────────────────────
// Box Engine v2 (grove-odoo-modules #60) reprices bareroot shipping PER PACKED
// BOX instead of per tree, because under UPS DIM billing the box drives the cost.
// The feed below is a faithful, strongly-typed mirror of grove_headless
// `models/shipping_zones.py::rate_feed()` — the same in-memory tables
// `compute_order_shipping` prices checkout with — so a fetched feed can never
// disagree with the actual charge. Source of truth: `shipping_boxes.py` (box
// catalog + packer) and `data/shipping_rates.json` (rates). Wire keys are kept
// snake_case to match the payload exactly (parity guarantee). Potted has no rates
// by design — potted is farm pickup only.

/** Box-catalog id from grove_headless `models/shipping_boxes.py` BOXES:
 * `br16` (single small whip), `s20`/`s32`/`s46` (8×8 boxes by length class),
 * `b20`/`b32` (12×12 dormant bulk boxes). A union so a fetched feed is checked
 * against the known catalog — the backend rate-checker only ever emits these. */
export type ShippingBoxId = "br16" | "s20" | "s32" | "s46" | "b20" | "b32";

/** Packing mode from `shipping_boxes.py` MODES. Trees are dormant or leafed-out
 * at the nursery by season, which drives per-box capacity. */
export type PackingMode = "dormant" | "leafed";

/** A single per-box shipping rate. `base` is the flat dollar charge for one
 * packed box of a given size to a given zone (v2 prices per box, not per tree). */
export interface ShippingBoxRate {
  base: number;
}

/** Zone id → box id → rate: the schema-2 `zones` map. Mirrors
 * `data/shipping_rates.json` (v2). Box-keyed, so it is NOT interchangeable with
 * the legacy tier-keyed {@link ShippingRateTable}. */
export type ShippingBoxRateTable = Record<
  string,
  Partial<Record<ShippingBoxId, ShippingBoxRate>>
>;

/** One box in the catalog, as surfaced by the feed's `packing.boxes` — a subset
 * of `shipping_boxes.py` BOXES (dimensions + capacity only; packaging/tare are
 * backend-internal). Dimensions in inches; `capacity` is trees-per-box by mode,
 * omitting any mode the box is never used in (`br16`/`b20`/`b32` have no
 * `leafed` capacity). */
export interface ShippingBoxSpec {
  length: number;
  width: number;
  height: number;
  capacity: Partial<Record<PackingMode, number>>;
}

/** The `packing` block of the schema-2 feed (`rate_feed().packing`): the box
 * catalog plus the constants a client needs to mirror `pack_order` exactly. */
export interface ShippingPackingSpec {
  boxes: Partial<Record<ShippingBoxId, ShippingBoxSpec>>;
  /** Minimum box length (in) a tree's height class can require: e.g. [16,20,32,46]. */
  length_classes: number[];
  modes: PackingMode[];
  /** Dormant-packing window as [[startMonth, startDay], [endMonth, endDay]]. */
  dormant_window: [[number, number], [number, number]];
}

/** Schema-2 rate feed from GET /grove/api/v1/shipping/rates — grove_headless
 * `rate_feed()` after Box Engine v2 (grove-odoo-modules #60). A read-only,
 * strongly-typed mirror of the in-memory tables the checkout engine prices with;
 * served from the same module globals, so it can never disagree with the charge
 * within a running instance. `zone_by_state` is the authoritative 21-state green
 * list the frontend eligibility gate must stay in lockstep with. */
export interface ShippingRateFeed {
  /** Feed schema version. 2 for Box Engine v2. */
  schema: number;
  zones: ShippingBoxRateTable;
  zone_by_state: Record<string, string>;
  green_states: string[];
  packing: ShippingPackingSpec;
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

/** A website (public) category as surfaced to the UI — the /shop cat-bar's
 * plant-type nav. `slug` is the stable `?cat=<slug>` URL key. */
export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  sku: string | null;
  description: string | null;
  seoDescription: string | null;
  /**
   * Plant-guide prose — Odoo's eCommerce Description (`website_description`),
   * null when unset. Publish-pipeline v2 makes Odoo the single source of truth
   * for guide copy; Ghost is OFF the product path (GOL-1012 / grove-sites#341,
   * correcting PR #338's Ghost fallback). Render this behind `guideReady`; never
   * fall back to Ghost for the product guide. Optional/undefined on list items
   * and mocks (the list endpoint doesn't carry guide prose) — the detail
   * normalizer populates it.
   */
  websiteDescription?: string | null;
  /**
   * Two-tier guide gate (Odoo `grove_guide_ready`, GOL-888). Only render
   * `websiteDescription` as the plant guide when true; false → "coming soon".
   * The detail normalizer defaults it to false, so list items, mocks, and
   * pre-field payloads gate closed and no un-reviewed draft leaks to the page.
   */
  guideReady?: boolean;
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
  /**
   * Website (public) categories — the plant-type browse taxonomy (Trees /
   * Shrubs / Vines) that drives the /shop cat-bar. Sourced from Odoo's
   * `product.template.public_categ_ids`. Each carries a stable `slug` for the
   * `?cat=<slug>` URL. Distinct from the free-form `tags` above: `categories`
   * is the curated storefront nav, `tags` is cross-cutting labels.
   *
   * Optional so per-tenant mockProducts don't have to specify it; the nursery
   * cat-bar reads it, other tenants can ignore it.
   */
  categories?: ProductCategory[];
  available: boolean;
  /**
   * Purchasability: `false` on a published-but-not-for-sale "coming soon"
   * placeholder (Odoo `sale_ok`, GOL-760) — the detail page renders but the buy
   * box is locked (no Add-to-Cart, no Bareroot "Reserve" deposit). Optional and
   * defaulted to purchasable in the normalizer, so list items, mocks, and older
   * payloads that omit it behave exactly as before.
   */
  saleOk?: boolean;
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
  /**
   * Distinct cultivar count — the "N varieties" card figure (GOL-919). Counts
   * unique cultivars, NOT the Cultivar × Format variant grid, so a plant with
   * only a Potted/Bareroot Format axis reads "1 variety". Present on list-
   * endpoint products; undefined for mocks and pre-GOL-919 payloads (the label
   * falls back to `variantCount` there).
   */
  cultivarCount?: number;
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
  /** Rootstock / propagation axis value (e.g. "M.111", "Seedling"); null when
   *  the product has no Rootstock attribute (GOL-1112). */
  rootstock?: string | null;
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

/** ZIP → USDA hardiness zone lookup result (GET /grove/api/v1/zone). Powers
 * the "Will this grow for me?" zone check — the buyer's ZIP resolves to a zone
 * that's compared against a plant's zoneMin..zoneMax, and doubles as the value
 * handed to the /shop `zone` list filter. */
export interface ZoneLookupResult {
  /** The 5-digit ZIP echoed back by the API. */
  zip: string;
  /** USDA hardiness zone (integer, roughly 2–10). */
  zone: number;
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
  /** How the order is fulfilled. `"pickup"` is the one legitimate $0-shipping
   * case (farm pickup); `"ship"` asserts a shipment, so the server rejects a
   * missing ship-to state rather than settling it as a silent $0-ship pickup
   * (GOL-1057). Omit to let the server infer from the ship-to state. */
  fulfillment?: "ship" | "pickup";
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

/** Input for POST /grove/api/v1/checkout/session — the order shape plus the
 *  redirect URLs Stripe returns the buyer to after (or instead of) paying. */
export interface CheckoutSessionInput extends OrderCreateInput {
  /** Absolute URL Stripe redirects to on success (the endpoint appends the
   *  Stripe session id so the success page can look the order up). */
  successUrl: string;
  /** Absolute URL Stripe redirects to on cancel / back. */
  cancelUrl: string;
}

/** The four kinds of charged-today line the checkout session itemizes. */
export type CheckoutLineItemKind = "goods" | "deposit" | "shipping" | "tax";

/** Raw itemized line in the session response (`line_items[]`). */
export interface ApiCheckoutLineItem {
  name: string;
  kind: CheckoutLineItemKind;
  unit_amount: number;
  quantity: number;
}

/** Raw response from POST /grove/api/v1/checkout/session. */
export interface ApiCheckoutSessionResponse {
  session_id: string;
  checkout_url: string;
  order_id: number;
  order_ref: string;
  access_token: string;
  has_preorder: boolean;
  amount_due_today: number;
  amount_total: number;
  currency: string;
  /** The exact array Stripe Checkout renders — goods / per-unit deposit /
   * shipping / WV tax. Optional: absent from an Odoo not yet on the GOL-1057
   * build, in which case the review falls back to the cart lines. */
  line_items?: ApiCheckoutLineItem[];
}

export interface CheckoutSession {
  sessionId: string;
  /** Stripe-hosted Checkout URL — redirect the browser here. */
  checkoutUrl: string;
  orderId: number;
  orderRef: string;
  accessToken: string;
  /** True when the cart contains a preorder line paid by deposit. */
  hasPreorder: boolean;
  /** Charged today: deposits + in-stock goods + shipping + tax on those. */
  amountDueToday: number;
  /** Full order value; `amountTotal - amountDueToday` is due at ship time. */
  amountTotal: number;
  currency: string;
  /** Itemized charged-today breakdown — the exact array Stripe renders, tagged
   * by `kind`. `amountDueToday` == Σ(unitAmount·quantity). Empty when the Odoo
   * build predates GOL-1057; callers fall back to the cart lines. */
  lineItems: CheckoutLineItem[];
}

/** One itemized charged-today line (camelCase mirror of ApiCheckoutLineItem). */
export interface CheckoutLineItem {
  name: string;
  kind: CheckoutLineItemKind;
  unitAmount: number;
  quantity: number;
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
      /** Food-forest layer facet (`grove_layer`): canopy | understory |
       * shrub | ground | vine. Filtered server-side (catalog API v1). */
      layer?: string;
      /** Sun-requirement facet (`grove_sun`): full | partial | shade.
       * Filtered server-side (catalog API v1). */
      sun?: string;
      limit?: number;
      offset?: number;
    }): Promise<ProductListResult>;
    get(id: number): Promise<Product>;
    getBySlug(slug: string): Promise<Product | null>;
  };
  /** Resolve a US ZIP to its USDA hardiness zone. Returns null for a ZIP the
   * USDA matrix doesn't cover (the endpoint 404s) or a malformed ZIP. */
  zone(zip: string): Promise<ZoneLookupResult | null>;
  shipping: {
    /** Legacy schema-1 tier-keyed rate table (GOL-952): a read-only mirror of
     * the per-tree engine that priced checkout before Box Engine v2. Feed the
     * result to the estimator's `resolveRateTable()` so quotes never drift from
     * the actual charge. Returns null when the feed is unreachable, empty, OR
     * already on schema 2 (box-keyed) — in every case the caller falls back to
     * the bundled snapshot, so this can never break the page. New callers should
     * use `rateFeed()`; this remains for a not-yet-upgraded Odoo. */
    rates(): Promise<ShippingRateTable | null>;
    /** Live schema-2 Box Engine v2 feed (GOL-1038): a read-only, strongly-typed
     * mirror of `rate_feed()` — box-keyed `zones`, the green-list `zone_by_state`
     * map, and the `packing` catalog the frontend needs to mirror the packer.
     * Returns null when the feed is unreachable, empty, or still schema 1 (Odoo
     * not yet upgraded), so a caller can safely fall back to its snapshot. */
    rateFeed(): Promise<ShippingRateFeed | null>;
  };
  cart: {
    get(): Promise<Cart>;
    addItem(productId: number, quantity?: number): Promise<Cart>;
  };
  orders: {
    create(input: OrderCreateInput): Promise<OrderSummary>;
    get(id: number, accessToken: string): Promise<OrderDetail>;
  };
  checkout: {
    createSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  };
}
