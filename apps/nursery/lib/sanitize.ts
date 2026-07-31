import sanitizeHtml from "sanitize-html";

/**
 * Sanitize Odoo-authored guide HTML (`website_description`) before rendering.
 *
 * Publish-pipeline v2 makes Odoo's eCommerce Description the single source of
 * truth for guide prose (Ghost is off the product path — GOL-1019 / #341). That
 * HTML is authored in the Odoo backend, so we never inject it unconditionally:
 * this strips event handlers, <script>, and javascript:/data: URLs while
 * allowing the tags Odoo's website editor produces. Mirrors the allowlist used
 * for CMS HTML in apps/hub/lib/sanitize.ts (`sanitizePostHtml`) — same tags,
 * attrs, and scheme rules, one trust boundary for all rendered rich text.
 *
 * Uses `sanitize-html` (pure-Node HTML parser) rather than DOMPurify/jsdom —
 * jsdom initialization stalls vitest, and the security goal is identical.
 */
export function sanitizeGuideHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "code", "pre",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote",
      "a", "img", "figure", "figcaption",
      "hr", "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      "*": ["href", "src", "alt", "title", "rel", "target"],
    },
    // Strip javascript:, data:, vbscript: — anchors must use http/https/mailto.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
  });
}
