import Image from "next/image";
import Link from "next/link";
import type { Post } from "@grove/ghost-client";
import { CaptureForm } from "@grove/ui-kit";
import { ghost } from "../../lib/ghost";

// Same reasoning as /shop — render-on-demand until Ghost webhooks land.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  // GOL-2756: there is deliberately NO seed/mock fallback here. Whatever Ghost
  // is doing, this page shows real posts or an honest "no posts" surface — it
  // must never publish invented entries under a Grove byline. The `?? []`
  // guards a 200 with an unexpected body (which used to throw a 500 on
  // `.length` rather than degrading to the empty state).
  let posts: Post[] = [];
  let failed = false;

  try {
    posts = (await ghost.posts.list({ limit: 10, include: "tags,authors" })) ?? [];
  } catch {
    failed = true;
  }

  return (
    <section className="journal">
      <div className="journal-head">
        <h1>
          From <span>the Grove</span>
        </h1>
        {posts.length > 0 && (
          <p className="journal-count">
            {posts.length} {posts.length === 1 ? "entry" : "entries"}
          </p>
        )}
      </div>

      {/* Error and empty are distinct, on-brand states (GOL-2756, mirroring
          nursery's GOL-1113 pattern). Meaning is carried by icon SHAPE +
          heading text + border style (solid vs dashed), never colour alone
          (WCAG 1.4.1 / colour-blind safety): the error uses an alert triangle
          and the retained plum accent, the empty state a growing sprout and
          Forest Command — no red/green pair, and both stay legible in
          grayscale and under deuteranopia/protanopia/tritanopia. */}
      {failed && (
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
            We couldn&rsquo;t reach the journal just now. This is on our end, not
            yours — try again in a moment, and in the meantime the trees are
            still in the ground.{" "}
            <Link href="/shop" className="journal-state__link">
              Browse the catalog
            </Link>
            .
          </p>
        </div>
      )}

      {!failed && posts.length === 0 && (
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
          <p className="journal-state__title">Fresh notes are on the way</p>
          <p className="journal-state__body">
            Nothing has been published to the journal just yet. We&rsquo;re
            writing up what&rsquo;s dropping, what&rsquo;s going in the ground,
            and when — check back soon, or sign up below and we&rsquo;ll bring
            it to you.{" "}
            <Link href="/shop" className="journal-state__link">
              Browse the catalog
            </Link>{" "}
            while you wait.
          </p>
        </div>
      )}

      {posts.length > 0 && (
        <div className="journal-grid">
          {posts.map((post) => (
            <article key={post.id} className="journal-card">
              {post.featureImage && (
                <div className="journal-card__img">
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
              <div className="journal-card__body">
                <p className="journal-card__date">
                  {new Date(post.published_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {post.reading_time > 0 && ` · ${post.reading_time} min read`}
                </p>
                {/* GOL-2788: the card used to be a dead end — excerpt and
                    nothing more. The link wraps only the TITLE (so a screen
                    reader announces "Bare-root season opens in November", not
                    the whole card read aloud as one link name) and the
                    ::after overlay in globals.css makes the rest of the card
                    a click target. */}
                <h2 className="journal-card__title">
                  <Link href={`/blog/${post.slug}`} className="journal-card__link">
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt && (
                  <p className="journal-card__excerpt">{post.excerpt}</p>
                )}
                {(post.authors?.[0] || (post.tags?.length ?? 0) > 0) && (
                  <div className="journal-card__foot">
                    {post.authors?.[0] && (
                      <span className="journal-card__meta">
                        {post.authors[0].name}
                      </span>
                    )}
                    {(post.tags?.length ?? 0) > 0 && (
                      <span className="journal-card__meta">
                        {post.tags.map((t) => t.name).join(" · ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="journal-capture">
        <CaptureForm
          brand="goldberry"
          source="newsletter-signup"
          label="treefacts-content"
          interests={["farm-updates"]}
          heading="Get the next #TreeFacts in your inbox"
          description="Every week we dig up one well-sourced fact about the trees we grow — the kind of thing that changes how you look at a hillside. We send the best ones out by email."
          submitLabel="Send me TreeFacts"
          successMessage="You're in. First one lands next week."
          consentText="About an email a week. Unsubscribe anytime."
          hubOptIn
        />
      </div>
    </section>
  );
}
