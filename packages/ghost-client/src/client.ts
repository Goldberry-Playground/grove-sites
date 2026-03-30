import type { GhostConfig, Post, Page, Author, GhostClient } from "./types";

function buildUrl(
  config: GhostConfig,
  resource: string,
  params: Record<string, string | number | undefined> = {}
): string {
  const version = config.version ?? "v5.0";
  const base = `${config.ghostUrl}/ghost/api/content/${resource}`;
  const searchParams = new URLSearchParams();
  searchParams.set("key", config.contentKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return `${base}/?${searchParams.toString()}`;
}

async function ghostFetch<T>(url: string, resource: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Ghost API error: ${response.status} ${response.statusText}`);
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
        const posts = await ghostFetch<Post[]>(url, "posts");
        if (!posts.length) {
          throw new Error(`Post with slug "${slug}" not found`);
        }
        return posts[0];
      },
    },

    pages: {
      async get(slug) {
        const url = buildUrl(config, `pages/slug/${slug}`);
        const pages = await ghostFetch<Page[]>(url, "pages");
        if (!pages.length) {
          throw new Error(`Page with slug "${slug}" not found`);
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
