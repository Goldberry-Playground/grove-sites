import type { GhostConfig, Post, Page, Author, GhostClient } from "./types";
import { GhostError } from "./errors";
import { buildUrl } from "./url";

async function ghostFetch<T>(url: string, resource: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    // GOL-2788: carries the status so callers can separate "no such post"
    // (render a 404) from "Ghost is down" (render the error state).
    throw new GhostError(
      `Ghost API error: ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  const data = (await response.json()) as Record<string, T>;
  return data[resource] as T;
}

/**
 * Create a typed Ghost Content API client.
 */
export function createGhostClient(config: GhostConfig): GhostClient {
  return {
    posts: {
      async list(params) {
        const url = buildUrl(config, "posts", {
          limit: params?.limit ?? 15,
          page: params?.page,
          filter: params?.filter,
          include: params?.include ?? "tags,authors",
        });
        return ghostFetch<Post[]>(url, "posts");
      },

      async get(slug) {
        const url = buildUrl(config, `posts/slug/${slug}`, {
          include: "tags,authors",
        });
        // `?? []` guards a 200 whose body has no `posts` key: `ghostFetch`
        // returns `data[resource]`, so that used to throw a TypeError on
        // `.length` — an outage-shaped failure for what is just an empty
        // result. Degrade to the not-found path instead (GOL-2756/GOL-2788).
        const posts = (await ghostFetch<Post[]>(url, "posts")) ?? [];
        if (!posts.length) {
          throw new GhostError(`Post with slug "${slug}" not found`, 404);
        }
        return posts[0];
      },
    },

    pages: {
      async get(slug) {
        const url = buildUrl(config, `pages/slug/${slug}`);
        const pages = (await ghostFetch<Page[]>(url, "pages")) ?? [];
        if (!pages.length) {
          throw new GhostError(`Page with slug "${slug}" not found`, 404);
        }
        return pages[0];
      },
    },

    authors: {
      async list(params) {
        const url = buildUrl(config, "authors", {
          limit: params?.limit ?? 50,
        });
        return ghostFetch<Author[]>(url, "authors");
      },
    },
  };
}
