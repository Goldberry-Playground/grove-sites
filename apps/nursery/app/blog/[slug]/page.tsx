import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isGhostNotFound, postLede, type Post } from "@grove/ghost-client";
import { ghost } from "../../../lib/ghost";
import { sanitizeGuideHtml } from "../../../lib/sanitize";
import { tenantConfig } from "../../../tenant.config";
import { DEFAULT_OG_IMAGE } from "../../../lib/site-metadata";

// Matches /blog — render-on-demand until Ghost webhooks land.
export const dynamic = "force-dynamic";

/**
 * One Ghost fetch per request, shared by `generateMetadata` and the page.
 *
 * Three outcomes have to stay distinguishable (GOL-2788): the post exists, the
 * post is gone, or Ghost is unreachable. Collapsing the last two would answer
 * 404 for a live page and tell search engines to drop it. `cache()` means
 * adding metadata did not double the Ghost traffic on every post view.
 */
const loadPost = cache(
  async (slug: string): Promise<{ post: Post | null; failed: boolean }> => {
    try {
      // `?? null` mirrors the list route's `?? []`: a 200 with an unexpected
      // body degrades to a clean 404 instead of throwing (GOL-2756).
      return { post: (await ghost.posts.get(slug)) ?? null, failed: false };
    } catch (e) {
      if (isGhostNotFound(e)) return { post: null, failed: false };
      return { post: null, failed: true };
    }
  },
);

/**
 * Per-post title, description and share card (GOL-2878 Phase 1).
 *
 * Same defect as the PDPs: every post served `<title>At The Grove
 * Nursery</title>` and the site-level description. It matters here too because
 * `app/sitemap.ts` now submits these URLs to search engines — advertising
 * twenty pages that share one title would just hand Google twenty duplicates.
 *
 * Everything below comes from Ghost (title, excerpt, feature image, dates); no
 * copy is written here. A post with no excerpt gets no description rather than
 * a generated one — an inherited site description would be worse than none,
 * since Google will compose a snippet from the body itself.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const { post } = await loadPost(slug);
  // Missing OR unreachable. Neither can produce honest metadata, and a
  // transient Ghost outage must not emit a canonical for a page that is about
  // to render the "journal is resting" error state.
  if (!post) return { title: "Journal", robots: { index: false, follow: true } };

  const description = post.excerpt?.trim() || undefined;
  const canonicalPath = `/blog/${post.slug}`;
  const image = post.featureImage ?? DEFAULT_OG_IMAGE;

  return {
    title: post.title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "article",
      siteName: tenantConfig.name,
      title: post.title,
      description,
      url: canonicalPath,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      images: [{ url: image, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Three outcomes, three surfaces (GOL-2788). Collapsing them would either
  // 500 on a deleted post or — worse — answer 404 for a post that exists but
  // that we simply could not reach, which lies to the reader and tells search
  // engines to drop a live page.
  const { post, failed } = await loadPost(slug);
  if (!failed && !post) notFound();

  if (failed) {
    return (
      <div className="journal-post">
        <JournalBack />
        <div role="alert" className="journal-state journal-error">
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
            We couldn&rsquo;t reach this entry just now. This is on our end, not
            yours — the note is still there, so try again in a moment.{" "}
            <Link href="/blog" className="journal-state__link">
              Back to {tenantConfig.copy.blogHeading}
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // Non-null past the guards above; `post!` keeps the narrowing readable.
  const entry = post as Post;

  // CMS HTML is never trusted: it goes through the same server-side allowlist
  // as the Odoo guide prose before injection (lib/sanitize.ts).
  const safeHtml = sanitizeGuideHtml(entry.html ?? "").trim();
  const lede = postLede(entry, safeHtml);
  const author = entry.authors?.[0]?.name;
  const published = new Date(entry.published_at);
  const publishedLabel = Number.isNaN(published.getTime())
    ? null
    : published.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  return (
    <article className="journal-post">
      <JournalBack />

      <header className="journal-post__head">
        <p className="journal-post__meta">
          {publishedLabel && (
            <time dateTime={entry.published_at}>{publishedLabel}</time>
          )}
          {author && <span>{author}</span>}
          {entry.reading_time > 0 && <span>{entry.reading_time} min read</span>}
        </p>
        <h1 className="journal-post__title">{entry.title}</h1>
        {lede && <p className="journal-post__lede">{lede}</p>}
      </header>

      {entry.featureImage && (
        <div className="journal-post__img">
          <Image
            src={entry.featureImage}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 720px) 100vw, 720px"
            priority
            unoptimized
          />
        </div>
      )}

      {safeHtml ? (
        <div
          className="journal-post__body rich-text"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      ) : (
        /* A published post with no body is rare but real (image-only or
           newsletter-only entries). Say so rather than ending on a blank. */
        <div role="status" className="journal-state journal-empty">
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
          <p className="journal-state__title">This note is still being written</p>
          <p className="journal-state__body">
            The entry is published but has no text yet. Check back shortly.{" "}
            <Link href="/blog" className="journal-state__link">
              Back to {tenantConfig.copy.blogHeading}
            </Link>
            .
          </p>
        </div>
      )}

      {(entry.tags?.length ?? 0) > 0 && (
        <ul className="journal-post__tags" aria-label="Topics">
          {entry.tags.map((tag) => (
            <li key={tag.id} className="journal-post__tag">
              {tag.name}
            </li>
          ))}
        </ul>
      )}

      <footer className="journal-post__foot">
        <Link href="/blog" className="journal-post__more">
          More from the beds
        </Link>
      </footer>
    </article>
  );
}

function JournalBack() {
  return (
    <nav aria-label="Breadcrumb" className="journal-post__back">
      <Link href="/blog">
        {/* SVG rather than a "←" character: the mono face this row is set in
            has no arrow glyph on every platform, and a tofu box in the
            breadcrumb is not a rounding error a reader forgives. */}
        <svg
          className="journal-post__back-arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18 9 12l6-6" />
        </svg>
        {tenantConfig.copy.blogHeading}
      </Link>
    </nav>
  );
}
