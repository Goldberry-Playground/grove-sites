import { NextResponse } from "next/server";
import type { OdooClient, ShippingTier } from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { sanitizeUpstreamError } from "./upstreamError";

/** One cart line, enriched with the live catalog facts a deposit rule needs. */
export interface CartQuoteLine {
  variantId: number;
  templateId: number;
  quantity: number;
  shippingTier: ShippingTier | null;
  format: string | null;
  /** Shared-pool on-hand quantity from the catalog API; null when omitted. */
  qtyAvailable: number | null;
  available: boolean;
}

export type CartQuoteFulfillment = "ship" | "pickup";

export interface CartQuoteRouteOptions<Quote> {
  /** Exact-match allowlist of `Origin` header values (same gate as /api/cart). */
  allowedOrigins: readonly string[];
  /**
   * The brand's charge rule. Receives every cart line with its live stock and
   * tier, plus the buyer's fulfillment choice (null when not yet chosen), and
   * returns whatever JSON the storefront's summary needs. The nursery wires the
   * GOL-2233 flat-deposit mirror here; the kit itself carries no money rule.
   */
  resolve: (
    lines: CartQuoteLine[],
    context: { fulfillment: CartQuoteFulfillment | null },
  ) => Quote;
}

const MAX_ITEMS = 50;
const MAX_QUANTITY = 9999;

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Build the POST handler for `/api/cart/quote` (pre-checkout charge preview).
 *
 * The cart and checkout-form summaries only know each line's unit price, so
 * they show the goods subtotal even when the backend will charge a flat
 * reservation deposit instead (GOL-2233). This route looks each line's variant
 * up on the live catalog (stock + shipping tier) and hands the enriched lines
 * to the brand's `resolve` rule so the page can say what is due today BEFORE
 * the Stripe session exists. Read-only: nothing is created in Odoo.
 */
export function createCartQuoteRoute<Quote>(
  odoo: OdooClient,
  { allowedOrigins, resolve }: CartQuoteRouteOptions<Quote>,
) {
  async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
    }

    const { items, fulfillment } = body as { items?: unknown; fulfillment?: unknown };
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `items must be a non-empty array of at most ${MAX_ITEMS} lines` },
        { status: 400 },
      );
    }
    const requested: { variantId: number; templateId: number; quantity: number }[] = [];
    for (const raw of items) {
      const item = raw as { variantId?: unknown; templateId?: unknown; quantity?: unknown };
      const quantity = Number(item?.quantity ?? 1);
      if (
        !isPositiveInt(item?.variantId) ||
        !isPositiveInt(item?.templateId) ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > MAX_QUANTITY
      ) {
        return NextResponse.json(
          { error: "each item needs a positive integer variantId and templateId and a quantity of 1..9999" },
          { status: 400 },
        );
      }
      requested.push({ variantId: item.variantId, templateId: item.templateId, quantity });
    }
    if (fulfillment !== undefined && fulfillment !== null && fulfillment !== "ship" && fulfillment !== "pickup") {
      return NextResponse.json({ error: 'fulfillment must be "ship" or "pickup"' }, { status: 400 });
    }

    // One catalog read per distinct template; every line of that template
    // resolves from the same payload.
    const templateIds = [...new Set(requested.map((r) => r.templateId))];
    let products;
    try {
      products = await Promise.all(templateIds.map((id) => odoo.products.get(id)));
    } catch (e) {
      return sanitizeUpstreamError(e, "cart/quote");
    }
    const variantsById = new Map<number, { shippingTier: ShippingTier | null; format: string | null; qtyAvailable: number | null; available: boolean }>();
    for (const product of products) {
      for (const v of product.variants) {
        variantsById.set(v.id, {
          shippingTier: v.shippingTier ?? null,
          format: v.format ?? null,
          qtyAvailable: v.qtyAvailable ?? null,
          available: v.available,
        });
      }
    }

    // A line whose variant no longer exists on its template can't be judged
    // here; checkout itself rejects it. Leave it out rather than guess.
    const lines: CartQuoteLine[] = [];
    for (const r of requested) {
      const v = variantsById.get(r.variantId);
      if (!v) continue;
      lines.push({ ...r, ...v });
    }

    const quote = resolve(lines, {
      fulfillment: fulfillment === "ship" || fulfillment === "pickup" ? fulfillment : null,
    });
    return NextResponse.json(quote);
  }

  return { POST };
}
