import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site-metadata";

/**
 * `robots.txt` for the nursery storefront (GOL-2878 Phase 1).
 *
 * Both `/robots.txt` and `/sitemap.xml` answered **404** on prod before this —
 * no app in the monorepo had either file, so nothing pointed a crawler at the
 * catalog (GOL-2875 §1c).
 *
 * The disallow list is transactional surfaces only. They carry no content worth
 * indexing, they are per-session, and `/checkout/success/[id]` would otherwise
 * expose order ids in search results. Crawling them is harmless — every one is
 * a GET — but indexing them is not.
 *
 * `/api/` is the BFF: JSON endpoints, nothing a search result should ever land
 * a person on.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/cart", "/checkout", "/notify"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
