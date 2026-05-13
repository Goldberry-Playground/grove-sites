import { NextResponse } from "next/server";

/**
 * Origin-header gate for state-changing requests.
 *
 * Returns true only when the `Origin` header is present AND matches the
 * caller's allowlist exactly. Browsers attach Origin to every cross-origin
 * POST and to same-origin fetches by default, so its absence on a state-
 * changing call is suspicious — we reject. Comparison is exact: no
 * wildcards, no port-stripping, no case folding (RFC 6454 origins are
 * case-sensitive in scheme and host).
 *
 * Trade-off: this rejects same-origin form POSTs that some older browsers
 * omit Origin for. We don't ship such forms — checkout/cart use fetch
 * from JS, which always emits Origin.
 */
export function isOriginAllowed(
  request: Request,
  allowed: readonly string[],
): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return allowed.includes(origin);
}

/**
 * Reject the request with 403 when the Origin gate fails.
 *
 * Status choice: 403 over 404. 404 would hide the endpoint from
 * enumeration but also confuses legitimate traffic during migrations and
 * makes operator debugging harder. The endpoint's existence is documented
 * public knowledge; obscuring it doesn't add meaningful security.
 */
export function rejectOrigin(): Response {
  return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
}
