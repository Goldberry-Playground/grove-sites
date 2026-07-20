/**
 * Order hand-off between the Stripe redirect and the success page.
 *
 * Stripe returns the buyer to our success URL with only `?session_id=…`, and
 * there is no `session_id → order` lookup in the API. But the client already
 * holds the order id + access token (they come back in the CheckoutSession
 * response, before the redirect), so we stash a compact, base64-encoded blob in
 * a first-party, path-scoped cookie right before redirecting. The success page
 * reads it server-side, renders the itemized confirmation + deposit breakdown,
 * then clears it. Keeping the access token in a `SameSite=Lax`, /checkout-scoped
 * cookie is strictly better than the old `?token=` URL (which leaked via the
 * Referer header). Pure module — safe to import from client and server.
 */
export const CHECKOUT_HANDOFF_COOKIE = "grove_checkout_handoff";

export interface CheckoutHandoff {
  orderId: number;
  accessToken: string;
  amountDueToday: number;
  amountTotal: number;
  hasPreorder: boolean;
  currency: string;
}

/** Encode a hand-off to the cookie value (UTF-8 safe). */
export function encodeHandoff(handoff: CheckoutHandoff): string {
  const json = JSON.stringify(handoff);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

/** Decode a cookie value back to a hand-off, or null if malformed. */
export function decodeHandoff(value: string | undefined | null): CheckoutHandoff | null {
  if (!value) return null;
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CheckoutHandoff;
    if (
      typeof parsed.orderId === "number" &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.amountDueToday === "number" &&
      typeof parsed.amountTotal === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
