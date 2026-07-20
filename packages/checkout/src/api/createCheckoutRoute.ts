import { NextResponse } from "next/server";
import type {
  OdooClient,
  OrderCreateInput,
  CheckoutSessionInput,
} from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { sanitizeUpstreamError } from "./upstreamError";
import { validateOrderInput, validateRedirectUrl } from "./validation";

export interface CheckoutRouteOptions {
  /** Exact-match allowlist of `Origin` header values. State-changing POSTs
   *  from any other origin are rejected with 403. Must include the dev URL
   *  (e.g. http://localhost:3001) alongside the production hostnames. */
  allowedOrigins: readonly string[];
}

/**
 * Build the POST handler for `/api/checkout` (draft order, no payment).
 *
 * Per-tenant OdooClient and Origin allowlist are injected so this single
 * implementation serves all three storefronts. Origin is checked before we
 * even parse the body — a cross-origin attacker shouldn't be able to trigger
 * any backend work, including JSON parsing.
 */
export function createCheckoutRoute(
  odoo: OdooClient,
  { allowedOrigins }: CheckoutRouteOptions,
) {
  return async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const error = validateOrderInput(payload);
    if (error) return NextResponse.json({ error }, { status: 400 });

    try {
      const order = await odoo.orders.create(payload as OrderCreateInput);
      return NextResponse.json(order);
    } catch (e) {
      return sanitizeUpstreamError(e, "checkout/create-order");
    }
  };
}

/**
 * Build the POST handler for `/api/checkout/session` (Stripe Checkout).
 *
 * Same validated order payload as `/api/checkout`, plus the `successUrl` /
 * `cancelUrl` the browser is redirected to. Returns the CheckoutSession (whose
 * `checkoutUrl` the client redirects to). The Stripe secret key never touches
 * the browser — the redirect target is Stripe's hosted page.
 */
export function createCheckoutSessionRoute(
  odoo: OdooClient,
  { allowedOrigins }: CheckoutRouteOptions,
) {
  return async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const orderError = validateOrderInput(payload);
    if (orderError) return NextResponse.json({ error: orderError }, { status: 400 });

    const p = payload as Record<string, unknown>;
    const successError = validateRedirectUrl(p.successUrl, "successUrl");
    if (successError) return NextResponse.json({ error: successError }, { status: 400 });
    const cancelError = validateRedirectUrl(p.cancelUrl, "cancelUrl");
    if (cancelError) return NextResponse.json({ error: cancelError }, { status: 400 });

    try {
      const session = await odoo.checkout.createSession(
        payload as CheckoutSessionInput,
      );
      return NextResponse.json(session);
    } catch (e) {
      return sanitizeUpstreamError(e, "checkout/create-session");
    }
  };
}
