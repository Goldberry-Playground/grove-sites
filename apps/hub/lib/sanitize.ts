import sanitizeHtml from "sanitize-html";

/**
 * Sanitize Ghost-authored post HTML before rendering. Allows the tags Ghost's
 * default editor produces; strips event handlers, script tags, and javascript:
 * URLs. Server-side: never trust CMS HTML unconditionally even when "we" wrote it.
 *
 * Uses `sanitize-html` (pure-Node HTML parser) rather than DOMPurify/jsdom —
 * jsdom initialization stalls vitest, and the security goal is identical.
 */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "code", "pre",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote",
      "a", "img", "figure", "figcaption",
      "hr",
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
