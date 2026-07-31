import { NextResponse } from "next/server";
import { OdooApiError } from "@grove/odoo-client";

/**
 * Backend statuses whose `{ "error": … }` message is safe to relay verbatim.
 *
 * grove_headless returns a friendly, actionable string for every one of these
 * (GOL-1036): 400 for the ship-to gates (unsupported state, potted farm-pickup
 * block) and payload rejections, 402 reserved for a future payment-declined
 * surface, 404 for a variant that vanished from the catalog, 409 for the
 * $0-shipping circuit breaker, and 503 while checkout is un-provisioned. These
 * are the messages a shopper needs to see to fix their cart, so we forward them
 * instead of collapsing to the generic 502. Anything else (5xx, network) still
 * routes through {@link sanitizeUpstreamError} — an unhandled Odoo 500 carries a
 * traceback and must never reach the browser.
 */
const CLIENT_SAFE_STATUSES = new Set([400, 402, 404, 409, 503]);

/**
 * If `error` is a client-safe upstream rejection, extract the backend's
 * friendly message and return it with the same status; otherwise `null`.
 *
 * The message is read from the parsed `{ "error": … }` body — never from the
 * composed `error.message` (which embeds `Odoo API error: 400 … — <body>` and
 * would leak the wrapper text). If the body isn't JSON, has no string `error`,
 * or the status isn't allow-listed, we return `null` so the caller falls back
 * to the sanitized 502 — a defensive default that keeps unexpected bodies
 * (e.g. an HTML error page) off the wire.
 */
export function forwardCheckoutError(error: unknown): Response | null {
  if (!(error instanceof OdooApiError)) return null;
  if (!CLIENT_SAFE_STATUSES.has(error.status)) return null;

  let message: unknown;
  try {
    message = (JSON.parse(error.body) as { error?: unknown }).error;
  } catch {
    return null;
  }
  if (typeof message !== "string" || message.length === 0) return null;

  return NextResponse.json({ error: message }, { status: error.status });
}

/**
 * Sanitize an upstream (Odoo) error into a client-safe 502 response.
 *
 * The OdooClient wraps non-2xx responses in `new Error("Odoo API error: …
 * — <body>")` where the body can include Odoo's Python traceback in dev/
 * staging or column names in prod. Returning `e.message` directly to the
 * browser leaks all of that. We log the raw error server-side (where
 * operators need it) and return a fixed string to the client.
 *
 * `fallback` is the operator-visible label that prefixes the server log
 * — keep it short and route-specific ("checkout/create-order").
 */
export function sanitizeUpstreamError(error: unknown, fallback: string): Response {
  // eslint-disable-next-line no-console -- intentional server log; the
  // sanitization is only useful if the operator can still see what broke.
  console.error(`[grove-checkout] ${fallback} upstream error:`, error);
  return NextResponse.json(
    { error: "Service temporarily unavailable. Please try again." },
    { status: 502 },
  );
}
