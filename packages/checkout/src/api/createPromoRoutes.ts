import { NextResponse } from "next/server";
import { OdooApiError, type OdooClient } from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { forwardCheckoutError, sanitizeUpstreamError } from "./upstreamError";
import { MAX_ITEMS, MAX_PROMO_CODE, MAX_QUANTITY, isValidItem } from "./validation";

export interface PromoRouteOptions {
  /** Exact-match allowlist of `Origin` header values (same gate as checkout). */
  allowedOrigins: readonly string[];
}

/** Shown when the backend predates the preview route (older modules pin): the
 *  code is still validated and applied when the payment session is created. */
export const PROMO_PREVIEW_UNAVAILABLE =
  "We can't check codes right now. Continue to payment and we'll apply it there if it's valid.";

async function readObject(request: Request): Promise<Record<string, unknown> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  return body as Record<string, unknown>;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * `POST /api/checkout/promo` — the checkout form's Apply button (GOL-2432).
 *
 * Forwards the cart + typed code to grove_headless
 * `POST /checkout/promo/preview`, which builds the draft order in a savepoint,
 * applies the code and the automatic volume tier (best single discount wins),
 * and rolls back. Read-only: no order, no Stripe session. The backend's
 * coupon-specific message ("needs 2 qualifying trees … add 1 more") is relayed
 * verbatim, whether it arrives as a 200 `{ok:false}` or a client-safe 4xx
 * (e.g. the deposit-cart refusal).
 */
export function createPromoPreviewRoute(odoo: OdooClient, { allowedOrigins }: PromoRouteOptions) {
  async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;
    const body = await readObject(request);
    if (body instanceof Response) return body;

    const { items, fulfillment, promoCode } = body;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `items must be a non-empty array of at most ${MAX_ITEMS} entries` },
        { status: 400 },
      );
    }
    if (!items.every(isValidItem)) {
      return NextResponse.json(
        { error: "Each item needs a positive integer variantId and finite quantity" },
        { status: 400 },
      );
    }
    if (fulfillment !== undefined && fulfillment !== null && fulfillment !== "ship" && fulfillment !== "pickup") {
      return NextResponse.json({ error: 'fulfillment must be "ship" or "pickup"' }, { status: 400 });
    }
    if (promoCode !== undefined && promoCode !== null && (typeof promoCode !== "string" || promoCode.length > MAX_PROMO_CODE)) {
      return NextResponse.json(
        { error: `promoCode must be a string of at most ${MAX_PROMO_CODE} chars` },
        { status: 400 },
      );
    }
    const code = typeof promoCode === "string" ? promoCode.trim() : "";

    try {
      const preview = await odoo.checkout.promoPreview({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        fulfillment: fulfillment === "ship" || fulfillment === "pickup" ? fulfillment : null,
        promoCode: code || undefined,
      });
      return NextResponse.json(preview);
    } catch (e) {
      if (e instanceof OdooApiError && e.status === 404) {
        // A 404 WITH a JSON `{error}` is a real answer (e.g. a variant left the
        // catalog); a bare 404 means the route itself isn't deployed yet.
        const forwarded = forwardCheckoutError(e);
        if (forwarded) return forwarded;
        return NextResponse.json({ error: PROMO_PREVIEW_UNAVAILABLE }, { status: 503 });
      }
      return forwardCheckoutError(e) ?? sanitizeUpstreamError(e, "checkout/promo");
    }
  }
  return { POST };
}

/**
 * `POST /api/cart/tiers` — data for the "Add 2 more trees to unlock 10% off"
 * nudge (GOL-2432). Returns the automatic volume tiers (cached feed) and how
 * many qualifying trees this cart holds.
 *
 * The count reads each line's `treeCount` off the live catalog: 1 per plant,
 * the bundle's tree count for a bundle (Remembrance Grove = 5), 0 for
 * supplies / gift cards / services. If any line's count is unknown (a backend
 * that predates the field, a vanished variant) the count is `null` and the
 * storefront shows no nudge — it never guesses a tree count into a promise.
 */
export function createCartTiersRoute(odoo: OdooClient, { allowedOrigins }: PromoRouteOptions) {
  async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;
    const body = await readObject(request);
    if (body instanceof Response) return body;

    const { items } = body;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `items must be a non-empty array of at most ${MAX_ITEMS} lines` },
        { status: 400 },
      );
    }
    const lines: { variantId: number; templateId: number; quantity: number }[] = [];
    for (const raw of items) {
      const item = raw as { variantId?: unknown; templateId?: unknown; quantity?: unknown };
      if (
        !isPositiveInt(item?.variantId) ||
        !isPositiveInt(item?.templateId) ||
        !isPositiveInt(item?.quantity) ||
        item.quantity > MAX_QUANTITY
      ) {
        return NextResponse.json(
          { error: "each item needs a positive integer variantId, templateId and quantity" },
          { status: 400 },
        );
      }
      lines.push({ variantId: item.variantId, templateId: item.templateId, quantity: item.quantity });
    }

    const tiers = await odoo.promotions.auto();
    // No live program → nothing to nudge toward; skip the catalog reads.
    if (tiers.length === 0) return NextResponse.json({ tiers, qualifyingUnits: null });

    let products;
    try {
      const templateIds = [...new Set(lines.map((l) => l.templateId))];
      products = await Promise.all(templateIds.map((id) => odoo.products.get(id)));
    } catch (e) {
      console.warn("cart/tiers: catalog unavailable, hiding nudge:", e);
      return NextResponse.json({ tiers, qualifyingUnits: null });
    }
    const treeCountByVariant = new Map<number, number | null>();
    for (const p of products) for (const v of p.variants) treeCountByVariant.set(v.id, v.treeCount ?? null);

    let units: number | null = 0;
    for (const l of lines) {
      const perUnit = treeCountByVariant.get(l.variantId);
      if (perUnit === undefined || perUnit === null) {
        units = null;
        break;
      }
      units += perUnit * l.quantity;
    }
    return NextResponse.json({ tiers, qualifyingUnits: units });
  }
  return { POST };
}
