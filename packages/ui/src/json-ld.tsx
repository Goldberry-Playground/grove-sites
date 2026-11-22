/**
 * Structured data (schema.org JSON-LD) helpers shared by the storefronts
 * (GOL-4086).
 */

/**
 * Serialize a JSON-LD object for a `<script>` body. Escapes `<` so a value
 * containing `</script>` cannot close the tag early, same as the farm Recipe
 * and hub alliance blocks.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** One `application/ld+json` script tag. Server-rendered; no client JS. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
  );
}

export interface OrganizationJsonLdInput {
  name: string;
  /** Absolute site origin, e.g. `https://atthegrovenursery.com`. */
  url: string;
  /** Logo URL. A site-relative path is resolved against `url`. */
  logo?: string | null;
  /**
   * Social profile URLs. Pass only the profiles the site's own footer links
   * to, so the block never claims an account the page does not show.
   */
  sameAs?: readonly string[];
}

/**
 * `Organization` block for a site homepage: name, URL, logo and `sameAs`.
 * Empty `logo` / `sameAs` are left out rather than emitted blank.
 */
export function organizationJsonLd({ name, url, logo, sameAs = [] }: OrganizationJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo ? { logo: new URL(logo, url).toString() } : {}),
    ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
  };
}
