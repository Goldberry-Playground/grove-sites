import type { Post } from "@grove/ghost-client";
import { ghost } from "../../lib/clients";

export const revalidate = 3600; // ISR: revalidate every hour

export default async function BlogPage() {
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    posts = await ghost.posts.list({ limit: 10, include: "tags,authors" });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load posts";
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-display font-bold text-primary mb-8">
        From the Grove
      </h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-8 text-red-800 text-sm">
          Unable to load blog posts. The blog will be available once Ghost is
          configured with a Content API key.
        </div>
      )}

      {posts.length === 0 && !error && (
        <p className="text-foreground/60 mb-8">
          No posts published yet. Check back soon!
        </p>
      )}

      <div className="space-y-8">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-primary/10 p-6 hover:border-primary/30 transition-colors"
          >
            <a href={`/blog/${post.slug}`}>
              {post.featureImage && (
                <img
                  src={post.featureImage}
                  alt={post.title}
                  className="w-full h-48 object-cover rounded mb-4"
                />
              )}
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-foreground/60 text-sm line-clamp-2">
                  {post.excerpt}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-foreground/40">
                {post.authors?.[0] && <span>{post.authors[0].name}</span>}
                <span>
                  {new Date(post.published_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {post.reading_time > 0 && (
                  <span>{post.reading_time} min read</span>
                )}
              </div>
              {(post.tags?.length ?? 0) > 0 && (
                <div className="flex gap-2 mt-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="text-xs bg-secondary/40 text-foreground/60 px-2 py-0.5 rounded"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
