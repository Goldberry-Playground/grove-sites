import type { MetadataRoute } from "next";
import type { Post } from "@grove/ghost-client";
import { marketplace } from "../data/marketplace";
import { ghost } from "../lib/ghost";
import { SITE_URL } from "../lib/site-metadata";

/**
 * `sitemap.xml` for gatheringatthegrove.com (GOL-3585). Mirrors the nursery's
 * (apps/nursery/app/sitemap.ts, GOL-2878): ISR at one hour, and the Ghost fetch
 * degrades to an empty list so the Docker build still prerenders it.
 *
 * Marketplace product pages are left out on purpose: each one is a pointer to
 * a product whose canonical home is the maker's own storefront, which lists it
 * in its own sitemap.
 */
export const revalidate = 3600;

const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/marketplace", priority: 0.9, changeFrequency: "daily" },
  { path: "/journal", priority: 0.8, changeFrequency: "weekly" },
  { path: "/alliance", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Absolute URL for a route. The root is `SITE_URL` with no trailing slash,
 * matching the canonical Next emits for `/`.
 */
function absolute(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

function staticEntries(): MetadataRoute.Sitemap {
  return STATIC_ROUTES.map((route) => ({
    url: absolute(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

/** Vendor profiles are static data, so they are always present. */
function vendorEntries(): MetadataRoute.Sitemap {
  return marketplace.vendors.map((vendor) => ({
    url: `${SITE_URL}/marketplace/vendor/${vendor.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

/** Published journal essays. */
async function postEntries(): Promise<MetadataRoute.Sitemap> {
  let posts: Post[] = [];
  try {
    posts = (await ghost().posts.list({ limit: 100 })) ?? [];
  } catch {
    return [];
  }
  return posts.map((post) => ({
    url: `${SITE_URL}/journal/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [...staticEntries(), ...vendorEntries(), ...(await postEntries())];
}
