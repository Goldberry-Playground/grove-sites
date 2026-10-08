import type { MetadataRoute } from "next";
import type { Product } from "@grove/odoo-client";
import type { Post } from "@grove/ghost-client";
import { odoo } from "../lib/clients";
import { ghost } from "../lib/ghost";
import { SITE_URL } from "../lib/site-metadata";

/**
 * `sitemap.xml` for the nursery storefront (GOL-2878 Phase 1).
 *
 * Nothing told Google these pages existed: `/sitemap.xml` was a 404 on prod and
 * no app in the monorepo had an `app/sitemap.ts` (GOL-2875 §1c).
 *
 * ## Caching
 * ISR at one hour, deliberately NOT `force-dynamic`. A sitemap is fetched by
 * crawlers a handful of times a day, but `force-dynamic` would flip the route
 * to `force-no-store` and make every one of those hits a full-catalog fetch
 * against the single Odoo droplet — the same trap `/shop` documents at the top
 * of `app/shop/page.tsx`.
 *
 * The cost of ISR is that the build prerenders this once, inside Docker, where
 * Odoo is unreachable. Both fetches below therefore degrade to an empty list
 * rather than failing the build, so the first hour after a deploy serves a
 * static-pages-only sitemap and the first revalidation fills in the rest. A
 * thin sitemap for an hour is a much smaller problem than a red build or a
 * hammered droplet.
 */
export const revalidate = 3600;

/**
 * Static routes worth indexing, with a relative priority.
 *
 * Priority is a hint, not a ranking input — it only tells a crawler how to
 * spend its budget within this one site. The catalog outranks the brochure
 * pages because that is what people search for. Transactional routes
 * (`/cart`, `/checkout`, `/notify`) are absent here and disallowed in
 * `robots.ts`.
 */
const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" },
  { path: "/shop/guilds", priority: 0.7, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/wholesale", priority: 0.5, changeFrequency: "monthly" },
  { path: "/shipping-warranty", priority: 0.3, changeFrequency: "monthly" },
];

/**
 * Every published product, as a PDP entry.
 *
 * `limit: 200` against a 137-row catalog: high enough that nothing is silently
 * truncated today, bounded enough that a runaway catalog cannot turn one
 * crawler hit into an unbounded response. If the catalog ever approaches this,
 * the sitemap needs real pagination (a sitemap index), not a bigger number.
 */
async function productEntries(): Promise<MetadataRoute.Sitemap> {
  let products: Product[] = [];
  try {
    products = (await odoo.products.list({ limit: 200 })).products;
  } catch {
    // Unreachable Odoo (notably: the Docker build). Ship the static routes
    // rather than failing the whole sitemap — see the caching note above.
    return [];
  }

  return products.map((product) => ({
    // Phase 1 serves the id form, because `/shop/[slug]` does not exist yet.
    // Phase 2 makes the slug canonical (GOL-2875 R1) — this is the one line
    // that has to change with it, and it must change in the SAME commit as the
    // route, or the sitemap advertises URLs that 404.
    url: `${SITE_URL}/shop/${product.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
}

/** Published blog posts. Independent of the product fetch — one can fail alone. */
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

  return [
    ...STATIC_ROUTES.map((route) => ({
      // The root is `SITE_URL` with no trailing slash, matching the canonical
      // Next emits for `/`. A sitemap that advertises a different spelling of
      // a URL than its own canonical is an avoidable mixed signal.
      url: route.path === "/" ? SITE_URL : `${SITE_URL}${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...products,
    ...posts,
  ];
}
