import { NextResponse } from "next/server";
import type {
  OdooClient,
  OrderCreateInput,
  OrderItemInput,
} from "@grove/odoo-client";
import { isOriginAllowed, rejectOrigin } from "./origins";
import { requireJsonContentType } from "./contentType";
import { sanitizeUpstreamError } from "./upstreamError";

const MAX_ITEMS = 100;
const MAX_QUANTITY = 9999;

// Field length caps. Tuned so legit international input flows through but
// junk/abuse payloads bounce at the BFF before reaching Odoo. RFC 5321 caps
// email at 254 chars; the rest are pragmatic ceilings well above real-world
// values (longest US state name "Massachusetts" is 13 chars, etc.).
const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_PHONE = 30;
const MAX_STREET = 200;
const MAX_CITY = 100;
const MAX_STATE = 50;
const MAX_ZIP = 20;
const MAX_COUNTRY = 100;

// Deliberately permissive — we'll let Odoo + the email-delivery layer handle
// the RFC 5322 long tail. This catches the actual failure mode we see today
// (typos like "abc" or "user@", missing '@', whitespace) without the famous
// 6000-character regex.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CheckoutRouteOptions {
  /** Exact-match allowlist of `Origin` header values. State-changing POSTs
   *  from any other origin are rejected with 403. Must include the dev URL
   *  (e.g. http://localhost:3001) alongside the production hostnames. */
  allowedOrigins: readonly string[];
}

function isValidItem(value: unknown): value is OrderItemInput {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.variantId === "number" &&
    Number.isFinite(v.variantId) &&
    Number.isInteger(v.variantId) &&
    v.variantId > 0 &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity > 0 &&
    v.quantity <= MAX_QUANTITY
  );
}

/** Required string in [1, max] chars. */
function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= max;
}

/** Optional string in [0, max] chars when present. Allows undefined/null/missing. */
function isOptionalBoundedString(
  value: unknown,
  max: number,
): value is string | undefined {
  if (value === undefined || value === null) return true;
  return typeof value === "string" && value.length <= max;
}

/**
 * Validate a shipping/billing address. Returns an error string keyed by the
 * outer field name (e.g. "shipping" or "billing") so the caller can surface
 * which block was bad, or null when valid.
 */
function validateAddress(addr: unknown, label: string): string | null {
  if (!addr || typeof addr !== "object") {
    return `${label} is required and must be an object`;
  }
  const a = addr as Record<string, unknown>;
  if (!isBoundedString(a.street, MAX_STREET)) {
    return `${label}.street is required and must be 1..${MAX_STREET} chars`;
  }
  if (!isOptionalBoundedString(a.street2, MAX_STREET)) {
    return `${label}.street2 must be a string of at most ${MAX_STREET} chars`;
  }
  if (!isBoundedString(a.city, MAX_CITY)) {
    return `${label}.city is required and must be 1..${MAX_CITY} chars`;
  }
  if (!isBoundedString(a.state, MAX_STATE)) {
    return `${label}.state is required and must be 1..${MAX_STATE} chars`;
  }
  if (!isBoundedString(a.zip, MAX_ZIP)) {
    return `${label}.zip is required and must be 1..${MAX_ZIP} chars`;
  }
  if (!isBoundedString(a.country, MAX_COUNTRY)) {
    return `${label}.country is required and must be 1..${MAX_COUNTRY} chars`;
  }
  return null;
}

/**
 * Build the POST handler for `/api/checkout`.
 *
 * Per-tenant OdooClient and Origin allowlist are injected so this single
 * implementation serves all three storefronts. Origin is checked before
 * we even parse the body — a cross-origin attacker shouldn't be able to
 * trigger any backend work, including JSON parsing.
 */
export function createCheckoutRoute(
  odoo: OdooClient,
  { allowedOrigins }: CheckoutRouteOptions,
) {
  return async function POST(request: Request) {
    if (!isOriginAllowed(request, allowedOrigins)) return rejectOrigin();
    const ctReject = requireJsonContentType(request);
    if (ctReject) return ctReject;

    let payload: OrderCreateInput;
    try {
      payload = (await request.json()) as OrderCreateInput;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // request.json() returns whatever JSON.parse returns — `null`, primitives,
    // and arrays all parse cleanly. Without this guard the next line dereferences
    // `null.contact`, which is an unhandled TypeError → 500 instead of 400.
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
    }

    if (!payload.contact?.email || !payload.contact?.name) {
      return NextResponse.json(
        { error: "contact.name and contact.email are required" },
        { status: 400 }
      );
    }

    if (!isBoundedString(payload.contact.name, MAX_NAME)) {
      return NextResponse.json(
        { error: `contact.name must be 1..${MAX_NAME} chars` },
        { status: 400 },
      );
    }

    if (
      typeof payload.contact.email !== "string" ||
      payload.contact.email.length > MAX_EMAIL ||
      !EMAIL_REGEX.test(payload.contact.email)
    ) {
      return NextResponse.json(
        { error: `contact.email must be a valid email of at most ${MAX_EMAIL} chars` },
        { status: 400 },
      );
    }

    if (!isOptionalBoundedString(payload.contact.phone, MAX_PHONE)) {
      return NextResponse.json(
        { error: `contact.phone must be a string of at most ${MAX_PHONE} chars` },
        { status: 400 },
      );
    }

    const shippingError = validateAddress(payload.shipping, "shipping");
    if (shippingError) {
      return NextResponse.json({ error: shippingError }, { status: 400 });
    }

    if (payload.billing !== undefined && payload.billing !== null) {
      const billingError = validateAddress(payload.billing, "billing");
      if (billingError) {
        return NextResponse.json({ error: billingError }, { status: 400 });
      }
    }

    if (
      !Array.isArray(payload.items) ||
      payload.items.length === 0 ||
      payload.items.length > MAX_ITEMS
    ) {
      return NextResponse.json(
        {
          error: `items must be a non-empty array of at most ${MAX_ITEMS} entries`,
        },
        { status: 400 }
      );
    }

    if (!payload.items.every(isValidItem)) {
      return NextResponse.json(
        {
          error:
            "Each item needs a positive integer variantId and finite quantity",
        },
        { status: 400 }
      );
    }

    try {
      const order = await odoo.orders.create(payload);
      return NextResponse.json(order);
    } catch (e) {
      return sanitizeUpstreamError(e, "checkout/create-order");
    }
  };
}
