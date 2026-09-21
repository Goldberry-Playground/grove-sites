import { sanitizeGuideHtml } from "../../../lib/sanitize";

/**
 * Product description (listing-content spec §E, GOL-2386). `html` is the
 * normalized `Product.description` — Odoo's `description_ecommerce` HTML, or
 * the escaped `description_sale` fallback while that is empty. It is authored
 * in the Odoo backend, so it goes through the same allow-list as the growing
 * guide (`lib/sanitize.ts`) before injection; never render it as raw markup.
 * Renders nothing when there is no description or nothing survives sanitizing.
 */
export function ProductDescription({ html }: { html: string | null | undefined }) {
  if (!html) return null;
  const safe = sanitizeGuideHtml(html).trim();
  if (!safe) return null;
  return (
    <div
      className="rich-text text-foreground/80 mt-10"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
