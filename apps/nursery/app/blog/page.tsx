import Image from "next/image";
import Link from "next/link";
import type { Post } from "@grove/ghost-client";
import { ghost } from "../../lib/ghost";
import { tenantConfig } from "../../tenant.config";

// Same reasoning as /shop — render-on-demand until Ghost webhooks land.
export const dynamic = "force-dynamic";

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
        {tenantConfig.copy.blogHeading}
      </h1>

      {/* Error and empty are distinct, on-brand states (GOL-1113). Meaning is
          carried by icon SHAPE + heading text, never colour alone (WCAG 1.4.1 /
          colour-blind safety): the error uses an alert triangle + plum accent,
          the empty state a growing sprout + leaf accent — distinguishable in
          grayscale and to deuteranopia/protanopia/tritanopia. */}
      {error && (
        <div
          role="alert"
          className="journal-state journal-error mb-8"
        >
          <svg
            className="journal-state__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="journal-state__title">The journal is resting</p>
          <p className="journal-state__body">
            We couldn&rsquo;t reach the journal just now. This is on our end, not
            yours — try again in a moment, and in the meantime the beds are still
            open.{" "}
            <Link href="/shop" className="journal-state__link">
              Browse the catalog
            </Link>
            .
          </p>
        </div>
      )}

      {posts.length === 0 && !error && (
        <div role="status" className="journal-state journal-empty mb-8">
          <svg
            className="journal-state__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 20h10" />
            <path d="M12 20v-9" />
            <path d="M12 11C12 7 9 4 4 4c0 5 3 7 8 7Z" />
            <path d="M12 13c0-3 2.5-5.5 7-5.5 0 4-2.5 5.5-7 5.5Z" />
          </svg>
          <p className="journal-state__title">Fresh notes are on the way</p>
          <p className="journal-state__body">
            Nothing has been published to the beds just yet. We&rsquo;re writing
            up what&rsquo;s growing, what to plant, and when — check back soon.{" "}
            <Link href="/shop" className="journal-state__link">
              Browse the catalog
            </Link>{" "}
            while you wait.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-primary/10 p-6 hover:border-primary/30 transition-colors"
          >
            <Link href={`/blog/${post.slug}`}>
              {post.featureImage && (
                <div className="relative w-full h-48 rounded overflow-hidden mb-4">
                  <Image
                    src={post.featureImage}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 896px) 100vw, 896px"
                    unoptimized
                  />
                </div>
              )}
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-ink-soft text-sm line-clamp-2">
                  {post.excerpt}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-ink-soft">
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
                      className="text-xs bg-secondary/40 text-ink-soft px-2 py-0.5 rounded"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
