import type { Metadata } from "next";
import { tenantConfig } from "../tenant.config";

/**
 * Site-level metadata shared by the root layout, page metadata, the sitemap and
 * robots.txt (GOL-3585). Mirrors apps/nursery/lib/site-metadata.ts (GOL-2878).
 *
 * Before this, the root layout had no `metadataBase`, so Next dropped every
 * relative canonical / og:url, and no page carried a share card.
 */

/** Absolute site origin. `metadataBase` in the root layout is built from this. */
export const SITE_URL = `https://${tenantConfig.domain}`;

/**
 * 1200×630 share card served from this app's own public/ (not the asset CDN),
 * so it ships with the image and can never 404 on a stale bucket.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/brand/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "The GGG Woodworking badge — three nested Gs around a walnut end-grain ring",
};

/** Root-layout defaults. Routes override per page via {@link pageMetadata}. */
export const SITE_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName: tenantConfig.name,
  locale: "en_US",
  title: tenantConfig.name,
  description: tenantConfig.description,
  images: [DEFAULT_OG_IMAGE],
};

export const SITE_TWITTER: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
  title: tenantConfig.name,
  description: tenantConfig.description,
  images: [DEFAULT_OG_IMAGE.url],
};

/**
 * Self-canonical + a complete share card for one route.
 *
 * Next REPLACES (does not merge) a parent's `openGraph`/`twitter` when a page
 * sets its own, so a page that sets only `openGraph.title` silently loses the
 * site name and image. Building every page's block from the site defaults here
 * keeps the card whole. `alternates.canonical` and `openGraph.url` are
 * deliberately never set in the root layout — inherited, they would point every
 * page's canonical at the homepage.
 */
export function pageMetadata({
  path,
  title,
  description = tenantConfig.description,
  shareTitle,
  type = "website",
}: {
  path: string;
  /** Document `<title>`. Omit to inherit the root layout's. */
  title?: string;
  description?: string;
  /** og:/twitter: title, when it should differ from `<title>`. */
  shareTitle?: string;
  type?: "website" | "article";
}): Metadata {
  // No title template on this site (checkout titles already carry the name),
  // so brand the share title here unless the page title already does.
  const ogTitle =
    shareTitle ??
    (!title ? tenantConfig.name : title.includes(tenantConfig.name) ? title : `${title} — ${tenantConfig.name}`);
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { ...SITE_OPEN_GRAPH, type, url: path, title: ogTitle, description },
    twitter: { ...SITE_TWITTER, title: ogTitle, description },
  };
}
