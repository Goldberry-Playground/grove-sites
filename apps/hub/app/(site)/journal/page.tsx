import Link from "next/link";
import type { Post } from "@grove/ghost-client";
import { ghost } from "../../../lib/ghost";
import { JournalState } from "../../../components/JournalState";

export const revalidate = 60;

export default async function JournalIndexPage() {
  // Two outcomes, two surfaces (GOL-2803). This route used to swallow every
  // failure into `posts = []` and print "No posts yet. Check back soon." — so a
  // Ghost outage read to the visitor as an empty journal. An empty journal and
  // a broken one are different facts and get different copy.
  let posts: Post[] = [];
  let failed = false;

  try {
    // `?? []` guards a 200 whose body has no `posts` key, which would otherwise
    // throw on `.length` and 500 where the empty state is correct (GOL-2756).
    posts = (await ghost().posts.list({ limit: 20 })) ?? [];
  } catch {
    failed = true;
  }

  return (
    <main className="journal">
      <header className="journal__head">
        <span className="eyebrow">— The Journal · Village notes —</span>
        <h1>Why we&apos;re building a village.</h1>
        <p>
          Long-form essays on cooperative commerce, regional resilience, Appalachian
          agroforestry, and the slow shape of mutual aid online.
        </p>
      </header>

      {failed && (
        <JournalState kind="error" title="We can’t reach the journal">
          The essays are still there — we just can&rsquo;t load them this minute.
          This is on our end, not yours. Try again shortly, or{" "}
          <Link href="/marketplace" className="journal-state__link">
            visit the marketplace
          </Link>{" "}
          in the meantime.
        </JournalState>
      )}

      {!failed && posts.length === 0 && (
        <JournalState kind="empty" title="The first essay is being written">
          Nothing has been published to the village journal yet. We&rsquo;re
          drafting on cooperative commerce and what it takes to keep a maker
          independent &mdash;{" "}
          <Link href="/marketplace" className="journal-state__link">
            meet the makers
          </Link>{" "}
          while you wait.
        </JournalState>
      )}

      {posts.length > 0 && (
        <ol className="journal__list">
          {posts.map((post) => (
            <li key={post.slug} className="journal__item">
              <Link href={`/journal/${post.slug}`}>
                <time>{new Date(post.published_at).toLocaleDateString("en-US")}</time>
                <h2>{post.title}</h2>
                {post.excerpt && <p>{post.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
