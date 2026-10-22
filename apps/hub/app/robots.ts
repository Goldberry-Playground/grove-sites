import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site-metadata";

/**
 * `robots.txt` (GOL-3585). Before this the route 404'd (or, behind Cloudflare,
 * served only the content-signals stub) and nothing pointed a crawler at the
 * sitemap. Same shape as apps/nursery/app/robots.ts: transactional, per-session
 * surfaces and the JSON BFF are disallowed — crawling them is harmless, indexing
 * them (order ids on `/checkout/success/[id]`) is not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
