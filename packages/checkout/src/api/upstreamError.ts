import { NextResponse } from "next/server";

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
