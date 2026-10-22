import type { MetadataRoute } from "next";
import type { Product } from "@grove/odoo-client";
import type { Post } from "@grove/ghost-client";
import { odoo } from "../lib/clients";
import { ghost } from "../lib/ghost";
import { SITE_URL } from "../lib/site-metadata";

/**
 * `sitemap.xml` for woodworkingeorge.com (GOL-3585). Mirrors the nursery's
 * (apps/nursery/app/sitemap.ts, GOL-2878): ISR at one hour rather than
 * `force-dynamic`, and every remote fetch degrades to an empty list so the
 * Docker build (Odoo and Ghost unreachable) still prerenders it.
 */
export const revalidate = 3600;

/** Indexable static routes. `/cart` and `/checkout` are absent and disallowed in `robots.ts`. */
const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
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

/** Published pieces. `limit: 200` bounds one crawler hit. */
async function productEntries(): Promise<MetadataRoute.Sitemap> {
  let products: Product[] = [];
  try {
    products = (await odoo.products.list({ limit: 200 })).products;
  } catch {
    return [];
  }
  return products.map((product) => ({
    url: `${SITE_URL}/shop/${product.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}

/** Published posts. Independent of the product fetch — one can fail alone. */
async function postEntries(): Promise<MetadataRoute.Sitemap> {
  let posts: Post[] = [];
  try {
    posts = (await ghost.posts.list({ limit: 100 })) ?? [];
  } catch {
    return [];
  }
  return posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at || post.published_at),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts] = await Promise.all([productEntries(), postEntries()]);
  return [...staticEntries(), ...products, ...posts];
}
