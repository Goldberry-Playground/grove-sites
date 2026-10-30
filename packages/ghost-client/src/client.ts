import type { GhostConfig, Post, Page, Author, GhostClient } from "./types";
import { GhostError } from "./errors";
import { buildUrl } from "./url";

// Ghost's Content API sends snake_case. `Post`/`Page`/`Author` expose the
// image fields camelCased, so map them here, once, for every app. Without
// this `featureImage` was always undefined and no blog rendered a feature
// image. Other snake_case fields (`published_at`, `reading_time`) are typed
// as Ghost sends them and pass through unchanged.
type RawAuthor = Omit<Author, "profileImage"> & { profile_image?: string | null };
type RawPost = Omit<Post, "featureImage" | "authors"> & {
  feature_image?: string | null;
  authors?: RawAuthor[];
};
type RawPage = Omit<Page, "featureImage"> & { feature_image?: string | null };

function toAuthor({ profile_image, ...raw }: RawAuthor): Author {
  return { ...raw, profileImage: profile_image ?? null };
}

function toPost({ feature_image, authors, ...raw }: RawPost): Post {
  return {
    ...raw,
    featureImage: feature_image ?? null,
    authors: (authors ?? []).map(toAuthor),
  };
}

function toPage({ feature_image, ...raw }: RawPage): Page {
  return { ...raw, featureImage: feature_image ?? null };
}

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
        const posts = (await ghostFetch<RawPost[]>(url, "posts")) ?? [];
        return posts.map(toPost);
      },

      async get(slug) {
        const url = buildUrl(config, `posts/slug/${slug}`, {
          include: "tags,authors",
        });
        // `?? []` guards a 200 whose body has no `posts` key: `ghostFetch`
        // returns `data[resource]`, so that used to throw a TypeError on
        // `.length` — an outage-shaped failure for what is just an empty
        // result. Degrade to the not-found path instead (GOL-2756/GOL-2788).
        const posts = (await ghostFetch<RawPost[]>(url, "posts")) ?? [];
        if (!posts.length) {
          throw new GhostError(`Post with slug "${slug}" not found`, 404);
        }
        return toPost(posts[0]);
      },
    },

    pages: {
      async get(slug) {
        const url = buildUrl(config, `pages/slug/${slug}`);
        const pages = (await ghostFetch<RawPage[]>(url, "pages")) ?? [];
        if (!pages.length) {
          throw new GhostError(`Page with slug "${slug}" not found`, 404);
        }
        return toPage(pages[0]);
      },
    },

    authors: {
      async list(params) {
        const url = buildUrl(config, "authors", {
          limit: params?.limit ?? 50,
        });
        const authors = (await ghostFetch<RawAuthor[]>(url, "authors")) ?? [];
        return authors.map(toAuthor);
      },
    },
  };
}
