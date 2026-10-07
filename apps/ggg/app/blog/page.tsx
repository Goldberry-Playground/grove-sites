import Image from "next/image";
import Link from "next/link";
import type { Post } from "@grove/ghost-client";
import { ghost } from "../../lib/ghost";
import { tenantConfig } from "../../tenant.config";

// Same reasoning as /shop — render-on-demand until Ghost webhooks land.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  // GOL-2756: no seed/mock fallback anywhere on this route — the journal shows
  // real posts or an honest "no posts" surface, never invented entries. The
  // `?? []` guards a 200 with an unexpected body (which used to throw a 500 on
  // `.length` rather than degrading to the empty state).
  let posts: Post[] = [];
  let failed = false;

  try {
    posts = (await ghost.posts.list({ limit: 10, include: "tags,authors" })) ?? [];
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-display font-bold text-primary mb-8">
        {tenantConfig.copy.blogHeading}
      </h1>

      {/* Error and empty are distinct, on-brand states (GOL-2756, mirroring
          nursery's GOL-1113 pattern). The old error box encoded "something
          broke" in raw Tailwind red alone and the empty state was a bare <p>.
          Meaning now rides on icon SHAPE + heading text + border style (solid
          vs dashed), so it survives grayscale and deuteranopia/protanopia/
          tritanopia (WCAG 1.4.1); colour is a secondary cue only — cherry for
          the error, amber for the friendly "coming soon", never red/green. */}
      {failed && (
        <div role="alert" className="journal-state journal-error mb-8">
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
          <p className="journal-state__title">The bench notes are offline</p>
          <p className="journal-state__body">
            We couldn&rsquo;t reach the journal just now. This is on our end, not
            yours — try again in a moment.{" "}
            <Link href="/shop" className="journal-state__link">
              See what&rsquo;s on the bench
            </Link>{" "}
            in the meantime.
          </p>
        </div>
      )}

      {!failed && posts.length === 0 && (
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
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h10" />
            <path d="M18.5 15.5v5" />
            <path d="M16 18h5" />
          </svg>
          <p className="journal-state__title">Nothing written up yet</p>
          <p className="journal-state__body">
            We&rsquo;re still at the bench. Build notes, wood stories and
            finished-piece write-ups land here as they&rsquo;re done — check
            back soon.{" "}
            <Link href="/shop" className="journal-state__link">
              See what&rsquo;s on the bench
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
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
