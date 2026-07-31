import { NextResponse } from "next/server";
import { OdooApiError } from "@grove/odoo-client";

/** Upstream 4xx statuses whose `{ error }` body is a deliberate, shopper-safe
 * gating message we forward to the browser verbatim:
 *   400 — unsupported ship-to state, potted / non-shippable block, bad payload
 *   404 — product variant not found
 *   409 — $0-shipping circuit breaker (rate-table gap)
 *   422 — reserved for future field-level validation
 * 401/403 (bad bearer token) and 5xx (Odoo tracebacks) are NOT here: those are
 * operator problems, not shopper-actionable, and may leak internals — they fall
 * through to the opaque 502 below. 503 ("Checkout is not configured yet") is
 * likewise masked; it is an ops state, not something the shopper can fix. */
const FORWARDABLE_STATUSES = new Set([400, 404, 409, 422]);

/** grove_headless gating messages are short human sentences. Cap the length so
 * an unexpected large/odd 4xx body can never be reflected onto the wire. */
const MAX_FORWARDED_MESSAGE = 400;

/** Pull a forwardable, shopper-safe message out of an upstream error body.
 * Returns undefined for anything that isn't a plain `{ error: string }` of
 * reasonable length — those get masked rather than forwarded. */
function forwardableMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const message = (body as Record<string, unknown>).error;
  if (
    typeof message === "string" &&
    message.length >= 1 &&
    message.length <= MAX_FORWARDED_MESSAGE
  ) {
    return message;
  }
  return undefined;
}

/**
 * Turn an upstream (grove_headless) error into a client response.
 *
 * Two paths:
 *   1. Deliberate gating errors — a 4xx `OdooApiError` whose JSON body carries a
 *      shopper-safe `{ error }` message (unsupported ship-to state, potted-block,
 *      $0-shipping breaker, …). We forward the upstream status + message so the
 *      checkout UI can show the real reason and its pickup / remove-lines offer
 *      instead of a blank "try again". These messages are written for shoppers.
 *   2. Everything else (5xx, unparseable bodies, 401/403/503, non-Error throws)
 *      — the OdooClient bakes the raw body (Python tracebacks in dev/staging,
 *      column names in prod) into `error.message`. Returning that leaks it, so
 *      we log server-side and return a fixed opaque 502.
 *
 * `fallback` is the operator-visible label that prefixes the server log
 * — keep it short and route-specific ("checkout/create-order").
 */
export function sanitizeUpstreamError(error: unknown, fallback: string): Response {
  if (error instanceof OdooApiError && FORWARDABLE_STATUSES.has(error.status)) {
    const message = forwardableMessage(error.body);
    if (message) {
      return NextResponse.json({ error: message }, { status: error.status });
    }
  }

  // eslint-disable-next-line no-console -- intentional server log; the
  // sanitization is only useful if the operator can still see what broke.
  console.error(`[grove-checkout] ${fallback} upstream error:`, error);
  return NextResponse.json(
    { error: "Service temporarily unavailable. Please try again." },
    { status: 502 },
  );
}
