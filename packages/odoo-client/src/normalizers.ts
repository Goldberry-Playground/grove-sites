// Pure normalizers — translate the grove_headless REST API's wire shape
// into the React-facing types defined in ./types.
//
// These are extracted from client.ts so they can be unit-tested without
// the fetch wrapper. Every UI bug class we've hit so far (qty_available
// missing, currency_id false, variant display_name) routes through here
// — high ROI for tests.

import type {
  ApiProductListItem,
  ApiProductDetail,
  ApiFacts,
  ApiProductImage,
  ApiCategory,
  ApiCartResponse,
  ApiOrderCreateResponse,
  ApiOrderDetail,
  ApiCheckoutSessionResponse,
  ApiZoneResponse,
  Product,
  ProductVariant,
  GrowingFacts,
  ProductImage,
  ProductCategory,
  Cart,
  CartItem,
  OrderSummary,
  OrderDetail,
  CheckoutSession,
  ZoneLookupResult,
} from "./types";

/** Odoo Selection/Char fields serialize "" when unset — collapse to null so
 * the UI can `??`-fall-back uniformly instead of testing for empty strings. */
function emptyToNull(value: string | undefined): string | null {
  return value ? value : null;
}

/**
 * Which serializer contract is the API speaking? Two generations exist:
 *
 *  - GOL-684 (grove-odoo-modules #41) and later: `image_url` is the
 *    authoritative signal — a real path when a photo exists, `null` when not.
 *    `image_128` is always `null` (the base64 payload was dropped for size).
 *  - Pre-GOL-684: `image_url` is ALWAYS a path (Odoo serves a gray placeholder
 *    at HTTP 200 for photo-less products), so the authoritative signal is
 *    `image_128`: base64 when a photo is set, `false` when empty (GOL-680).
 *
 * Collapse to "" when there's no real photo so <ProductImage> renders the
 * branded botanical placeholder instead of Odoo's gray box. `null` image_128
 * (new contract) must NOT be read as "no photo" — that regression blanked
 * every uploaded product photo on QA (2026-07-23). Undefined `image_128`
 * (older/partial payload omitting the field) still means "trust the URL".
 */
function photoUrlOrEmpty(
  imageUrl: string | null,
  image128: string | false | null | undefined,
): string {
  if (!imageUrl) return ""; // new contract: null/empty URL = no photo
  if (image128 === false) return ""; // old contract: explicit no-photo marker
  return imageUrl; // base64 present, or null/undefined image_128 = trust the URL
}

export function normalizeProductListItem(raw: ApiProductListItem): Product {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    sku: raw.default_code || null,
    description: null,
    seoDescription: null,
    price: raw.list_price,
    currency: null,
    imageUrl: photoUrlOrEmpty(raw.image_url, raw.image_128),
    categoryId: null,
    categoryName: null,
    tags: (raw.tags ?? []).map((t) => t.name),
    categories: (raw.categories ?? []).map(normalizeCategory),
    priceMin: raw.price_min,
    variantCount: raw.variant_count,
    cultivarCount: raw.cultivar_count,
    available: raw.website_published,
    // Coming-soon placeholders (sale_ok=false) now appear in the grid and
    // ?cat= facets (GOL-760). Default true so mocks and older payloads that
    // omit the field stay purchasable.
    saleOk: raw.sale_ok ?? true,
    featured: raw.grove_featured,
    variants: [],
  };
}

export function normalizeProductDetail(raw: ApiProductDetail): Product {
  // Authoritative "has a real photo" flag for this template (see photoUrlOrEmpty).
  // Variants don't carry their own image_128, and in this catalog a variant only
  // shows the template photo (or Odoo's inherited gray default) — so when the
  // template has no photo, blank the variants' URLs too, otherwise the buy box's
  // variant thumbnail (product-view: hero = variantImage ?? heroImage) would
  // resurrect Odoo's gray box over the branded placeholder.
  const hasTemplatePhoto = raw.image_128 === undefined || Boolean(raw.image_128);
  return {
    id: raw.id,
    // The detail endpoint returns `grove_slug`, not the list endpoint's aliased
    // `slug`. Reading `raw.slug` alone yielded `undefined`, which rendered
    // featured ProductCard links as `/marketplace/<vendor>/undefined` (GOL-400).
    // Featured products resolve via getBySlug → this normalizer, so this is the
    // single choke point for that bug.
    slug: raw.slug ?? raw.grove_slug,
    name: raw.name,
    sku: raw.default_code || null,
    description: raw.description_sale || null,
    seoDescription: raw.grove_seo_description || null,
    // Guide prose from Odoo's eCommerce Description (publish-pipeline v2 SoR).
    // `false`/"" collapse to null so the UI can `??`-fall-back uniformly.
    websiteDescription: raw.website_description || null,
    // Two-tier guide gate — default CLOSED when the field is absent so a
    // grove_headless build that predates `grove_guide_ready` can't leak an
    // un-reviewed draft as a live guide (GOL-888 / GOL-1012).
    guideReady: raw.grove_guide_ready ?? false,
    price: raw.list_price,
    currency: raw.currency_id ? raw.currency_id.name : null,
    imageUrl: photoUrlOrEmpty(raw.image_url, raw.image_128),
    categoryId: raw.categ_id ? raw.categ_id.id : null,
    categoryName: raw.categ_id ? raw.categ_id.name : null,
    tags: (raw.tags ?? []).map((t) => t.name),
    categories: (raw.categories ?? []).map(normalizeCategory),
    // qty_available is only present when the Odoo `stock` module is installed.
    // Fall back to the parent product's website_published flag so the page
    // still distinguishes "out of stock" from "we don't track stock at all".
    available: raw.qty_available === undefined ? raw.website_published : raw.qty_available > 0,
    // sale_ok gates purchasability independently of stock: a "coming soon"
    // placeholder is published (page renders) but not for sale (buy box locked).
    // Default true so list items, mocks, and older payloads that omit the field
    // stay purchasable (GOL-760).
    saleOk: raw.sale_ok ?? true,
    featured: raw.grove_featured,
    variants: (raw.variants ?? [])
      .map(normalizeVariant)
      .map((v) => (hasTemplatePhoto ? v : { ...v, imageUrl: "" })),
    facts: raw.facts ? normalizeFacts(raw.facts) : undefined,
    images: (raw.images ?? []).map(normalizeImage),
  };
}

export function normalizeVariant(raw: ApiProductDetail["variants"][number]): ProductVariant {
  return {
    id: raw.id,
    name: raw.display_name,
    sku: raw.sku || null,
    price: raw.price,
    // Same fallback story as normalizeProductDetail — see comment there. The
    // v1 API always sends qty_available (stock is a hard dep), but keep the
    // defensive default so an older/partial payload can't render a live product
    // as sold out.
    available: raw.qty_available === undefined ? true : raw.qty_available > 0,
    // Exact on-hand count for the "N in stock" line (catalog API v1 always
    // sends it). null on an older/partial payload that omits qty_available —
    // the page then shows the boolean state only, never a fabricated "0".
    qtyAvailable: raw.qty_available ?? null,
    // GOL-684 contract: null image_url = no variant photo → "" renders the placeholder.
    imageUrl: raw.image_url ?? "",
    cultivar: emptyToNull(raw.cultivar),
    format: emptyToNull(raw.format),
    rootstock: emptyToNull(raw.rootstock),
    shippingTier: raw.shipping_tier || null,
  };
}

export function normalizeFacts(raw: ApiFacts): GrowingFacts {
  return {
    botanicalName: emptyToNull(raw.botanical_name),
    zoneMin: raw.zone_min ?? null,
    zoneMax: raw.zone_max ?? null,
    layer: emptyToNull(raw.layer),
    sun: emptyToNull(raw.sun),
    matureSize: emptyToNull(raw.mature_size),
    spacing: emptyToNull(raw.spacing),
    soil: emptyToNull(raw.soil),
  };
}

export function normalizeCategory(raw: ApiCategory): ProductCategory {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
  };
}

export function normalizeImage(raw: ApiProductImage): ProductImage {
  return {
    id: raw.id,
    url: raw.url,
    thumbUrl: raw.thumb_url,
  };
}

export function normalizeZone(raw: ApiZoneResponse): ZoneLookupResult {
  return {
    zip: raw.zip,
    zone: raw.zone,
  };
}

export function normalizeCart(raw: ApiCartResponse): Cart {
  return {
    id: raw.id ?? null,
    items: raw.lines.map(normalizeCartItem),
    subtotal: raw.amount_untaxed ?? 0,
    tax: raw.amount_tax ?? 0,
    total: raw.amount_total,
    currency: raw.currency?.name ?? null,
  };
}

export function normalizeCartItem(raw: ApiCartResponse["lines"][number]): CartItem {
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

export function normalizeOrderSummary(raw: ApiOrderCreateResponse): OrderSummary {
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
}

export function normalizeCheckoutSession(
  raw: ApiCheckoutSessionResponse
): CheckoutSession {
  return {
    sessionId: raw.session_id,
    checkoutUrl: raw.checkout_url,
    orderId: raw.order_id,
    orderRef: raw.order_ref,
    accessToken: raw.access_token,
    hasPreorder: raw.has_preorder,
    amountDueToday: raw.amount_due_today,
    amountTotal: raw.amount_total,
    currency: raw.currency,
    lineItems: (raw.line_items ?? []).map((li) => ({
      name: li.name,
      kind: li.kind,
      unitAmount: li.unit_amount,
      quantity: li.quantity,
    })),
  };
}

export function normalizeOrderDetail(raw: ApiOrderDetail): OrderDetail {
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
}
