/**
 * Shared security response headers for the four storefronts (GOL-3584).
 *
 * Set in the app rather than at the Cloudflare edge because the nursery
 * apex/www are DNS-only, so a Transform Rule would not cover them.
 *
 * CSP here is `frame-ancestors` only (clickjacking). A full script/style CSP
 * is a separate issue: Odoo/Ghost HTML bodies and RUM inject inline scripts.
 *
 * HSTS covers subdomains. Every subdomain in the four zones answers HTTPS,
 * including the Mailgun tracking hosts (`email.mg.<brand>`, moved to HTTPS in
 * GOL-3594). A new subdomain must serve HTTPS before it goes live.
 *
 * Permissions-Policy denies device APIs no storefront uses. `microphone` stays
 * allowed for our own origin only, so the Odoo livechat widget (which runs in
 * our document, not an iframe) keeps voice messages while embeds cannot ask.
 */
export const securityHeaders: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Legacy fallback for browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

/** `headers()` entry applying {@link securityHeaders} to every route. */
export const securityHeadersRoute = {
  source: "/:path*",
  headers: securityHeaders,
};
