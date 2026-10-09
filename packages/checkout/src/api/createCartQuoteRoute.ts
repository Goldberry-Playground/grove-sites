import { NextResponse } from "next/server";
import { OdooApiError, type OdooClient, type ShippingTier, type ShipWave } from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { forwardCheckoutError, sanitizeUpstreamError } from "./upstreamError";
import { SEED_DEPOSIT } from "../seed";

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
  /**
   * Ask the backend's authoritative `POST /checkout/quote` first (GOL-2233):
   * it runs the exact predicate the checkout session charges by, on live FREE
   * stock (on-hand minus reserved), which the catalog's on-hand count can't
   * see. Falls back to `resolve` when the backend predates the route (404) or
   * fails, so the storefront ships safely ahead of the modules pin bump.
   * Default true.
   */
  preferBackend?: boolean;
}

/** Flat per-order pre-order deposit in dollars (backend `PREORDER_DEPOSIT`). */
export const WAVE_PREORDER_DEPOSIT = 10;

/**
 * The fallback answer for a wave cart when the backend quote is unavailable.
 * A wave cart is always a pre-order: one flat $10 deposit today, whatever the
 * stock. `estimated: true` marks it as the storefront's own estimate, so it is
 * display-only: the checkout guard (`preorderDepositConfirmed`) never treats it
 * as the backend confirming the deposit, and submit stays blocked.
 */
export interface EstimatedWaveQuote {
  depositNow: true;
  depositReason: "preorder";
  shipWave: ShipWave;
  depositAmount: number;
  amountDueToday: number;
  estimated: true;
}

function estimatedWaveQuote(shipWave: ShipWave): EstimatedWaveQuote {
  return {
    depositNow: true,
    depositReason: "preorder",
    shipWave,
    depositAmount: WAVE_PREORDER_DEPOSIT,
    amountDueToday: WAVE_PREORDER_DEPOSIT,
    estimated: true,
  };
}

/**
 * The fallback answer for an all-seed cart when the backend quote is
 * unavailable (GOL-3258): one flat $1 seed deposit. Display-only for the same
 * reason as {@link estimatedWaveQuote}: `seedDepositConfirmed` ignores it, so
 * checkout stays blocked until the backend itself says `seed`.
 */
export interface EstimatedSeedQuote {
  depositNow: true;
  depositReason: "seed";
  depositAmount: number;
  amountDueToday: number;
  estimated: true;
}

function estimatedSeedQuote(): EstimatedSeedQuote {
  return {
    depositNow: true,
    depositReason: "seed",
    depositAmount: SEED_DEPOSIT,
    amountDueToday: SEED_DEPOSIT,
    estimated: true,
  };
}

/** A US ZIP: five digits, optionally ZIP+4. Only the first five reach the backend. */
const ZIP_RE = /^\d{5}(?:-\d{4})?$/;

/**
 * The quote route's answer when the backend refuses the cart's wave for this
 * destination (GOL-3194). `alternateWave` is set only when the backend has
 * CONFIRMED the other wave would quote for the same cart and ZIP, so the
 * storefront can offer a one-tap switch without parsing the refusal copy.
 */
export interface WaveRefusal {
  error: string;
  alternateWave?: ShipWave;
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
  { allowedOrigins, resolve, preferBackend = true }: CartQuoteRouteOptions<Quote>,
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

    const { items, fulfillment, shipWave, zip } = body as {
      items?: unknown;
      fulfillment?: unknown;
      shipWave?: unknown;
      zip?: unknown;
    };
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

    if (shipWave !== undefined && shipWave !== null && shipWave !== "fall" && shipWave !== "spring") {
      return NextResponse.json({ error: 'shipWave must be "fall" or "spring"' }, { status: 400 });
    }
    const waveChoice: ShipWave | null = shipWave === "fall" || shipWave === "spring" ? shipWave : null;

    if (zip !== undefined && zip !== null && (typeof zip !== "string" || !ZIP_RE.test(zip.trim()))) {
      return NextResponse.json({ error: "zip must be a 5-digit US ZIP code" }, { status: 400 });
    }

    const fulfillmentChoice: CartQuoteFulfillment | null =
      fulfillment === "ship" || fulfillment === "pickup" ? fulfillment : null;
    // The destination ZIP only means something for a shipped order: a pickup
    // wave is judged against the farm's own zone, whatever the shopper typed.
    const destinationZip =
      typeof zip === "string" && fulfillmentChoice !== "pickup" ? zip.trim().slice(0, 5) : undefined;

    // Backend first: the authoritative answer, straight from the predicate the
    // checkout session charges by. A 404 means the modules pin predates the
    // route; any other failure is logged by the fallback path's own errors.
    if (preferBackend) {
      try {
        const quote = await odoo.checkout.quote({
          items: requested.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
          fulfillment: fulfillmentChoice,
          shipWave: waveChoice ?? undefined,
          ...(destinationZip ? { zip: destinationZip } : {}),
        });
        return NextResponse.json(quote);
      } catch (e) {
        // A 400 is a real answer the shopper must see and act on (mixed cart,
        // closed wave, potted line out of season): relay it, never estimate past it.
        if (e instanceof OdooApiError && e.status === 400) {
          const forwarded = forwardCheckoutError(e);
          if (forwarded) {
            // A refused FALL pre-order may still go out in spring (the backend's
            // own copy says "Choose spring."). Ask the backend whether the same
            // cart quotes as spring for the same destination; only a confirmed
            // yes earns the switch, so we never offer a wave that is shut too.
            if (waveChoice === "fall") {
              try {
                await odoo.checkout.quote({
                  items: requested.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
                  fulfillment: fulfillmentChoice,
                  shipWave: "spring",
                  ...(destinationZip ? { zip: destinationZip } : {}),
                });
                const { error } = (await forwarded.json()) as { error: string };
                return NextResponse.json({ error, alternateWave: "spring" } satisfies WaveRefusal, {
                  status: 400,
                });
              } catch {
                // Spring refused (or the probe failed): relay the fall refusal as-is.
              }
            }
            return forwarded;
          }
        }
        if (!(e instanceof OdooApiError && e.status === 404)) {
          console.warn("cart/quote: backend quote unavailable, using catalog estimate:", e);
        }
      }
    }

    // A wave cart is a pre-order by definition; the brand rule only knows the
    // stock / cutover triggers and would estimate it as charged in full while
    // the page says $10 deposit. Answer with the (display-only) wave estimate.
    if (waveChoice) return NextResponse.json(estimatedWaveQuote(waveChoice));

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

    // An all-seed cart is a $1 seed pre-order by definition; the brand rule
    // only knows the tree triggers and would estimate it as charged in full.
    if (lines.length > 0 && lines.every((l) => l.shippingTier === "seed")) {
      return NextResponse.json(estimatedSeedQuote());
    }

    const quote = resolve(lines, { fulfillment: fulfillmentChoice });
    return NextResponse.json(quote);
  }

  return { POST };
}
