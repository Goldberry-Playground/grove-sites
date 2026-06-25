import Image from "next/image";
import Link from "next/link";
import type { Post } from "@grove/ghost-client";
import { ghost } from "../../lib/ghost";
import { mockPosts } from "../../data/mock-posts";

// Same reasoning as /shop — render-on-demand until Ghost webhooks land.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  let posts: Post[] = [];
  let usingMockData = false;

  try {
    posts = await ghost.posts.list({ limit: 10, include: "tags,authors" });
  } catch {
    // Ghost unreachable — fall back to seed data so the journal is still
    // demoable. Remove this branch when Ghost is consistently up.
    posts = mockPosts;
    usingMockData = true;
  }

  if (posts.length === 0) {
    posts = mockPosts;
    usingMockData = true;
  }

  return (
    <section className="catalog">
      <div className="cat-header">
        <h2>
          From <span>the Grove</span>
        </h2>
        <div className="meta">
          {posts.length} {posts.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {usingMockData && (
        <div
          style={{
            background: "var(--bone)",
            border: "1px solid var(--bone-deep)",
            borderLeft: "4px solid var(--amber)",
            padding: "0.8rem 1.2rem",
            marginBottom: "2rem",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color: "var(--walnut-light)",
          }}
        >
          Demo journal · These posts are placeholders until Ghost CMS is
          connected.
        </div>
      )}

      <div className="cat-grid">
        {posts.map((post) => (
          <article key={post.id} className="cat-card">
            {post.featureImage && (
              <div className="cat-img">
                <Image
                  src={post.featureImage}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  unoptimized
                />
              </div>
            )}
            <div className="cat-info">
              <span className="cat-spec">
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {post.reading_time > 0 && ` · ${post.reading_time} min read`}
              </span>
              <h3 className="cat-name">{post.title}</h3>
              {post.excerpt && (
                <p className="cat-desc">{post.excerpt}</p>
              )}
              <div className="cat-foot">
                {post.authors?.[0] && (
                  <span className="cat-meta">{post.authors[0].name}</span>
                )}
                {(post.tags?.length ?? 0) > 0 && (
                  <span className="cat-meta">
                    {post.tags.map((t) => t.name).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
