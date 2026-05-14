import { NextResponse } from "next/server";
import type { OdooClient } from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { sanitizeUpstreamError } from "./upstreamError";

export interface CartRouteOptions {
  /** Exact-match allowlist of `Origin` header values for state-changing
   *  POSTs. GET is left ungated — it's read-only. */
  allowedOrigins: readonly string[];
}

/**
 * Build the GET/POST handlers for `/api/cart`.
 *
 * Each storefront wires this with its own OdooClient (per-tenant URL/key)
 * so a single implementation lives here. Security-relevant tightening
 * (Origin gate, error sanitization, length caps) belongs in this file —
 * fix once, every tenant benefits.
 */
export function createCartRoute(
  odoo: OdooClient,
  { allowedOrigins }: CartRouteOptions,
) {
  async function GET() {
    try {
      const cart = await odoo.cart.get();
      return NextResponse.json(cart);
    } catch (e) {
      return sanitizeUpstreamError(e, "cart/get");
    }
  }

  async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;

    // Parse + shape-check separately so a malformed body returns 400 instead
    // of falling into sanitizeUpstreamError below — that helper assumes
    // upstream Odoo is the failure source and would log to operator alerting
    // ("cart/add-item upstream error") for what is really a client mistake.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
    }

    const { product_id, quantity } = body as { product_id?: unknown; quantity?: unknown };

    const productId = Number(product_id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "product_id must be a positive integer" },
        { status: 400 },
      );
    }

    // Coerce missing/null to 1, then validate. Reject NaN, non-finite, ≤ 0,
    // or absurdly large quantities (Odoo would happily accept 1e308 and
    // overflow somewhere downstream).
    const rawQty = quantity ?? 1;
    const qtyNumber = Number(rawQty);
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0 || qtyNumber > 9999) {
      return NextResponse.json(
        { error: "quantity must be a positive number not greater than 9999" },
        { status: 400 },
      );
    }

    try {
      const cart = await odoo.cart.addItem(productId, qtyNumber);
      return NextResponse.json(cart);
    } catch (e) {
      return sanitizeUpstreamError(e, "cart/add-item");
    }
  }

  return { GET, POST };
}
