import Link from "next/link";
import { createGhostClient, type Post } from "@grove/ghost-client";

export const revalidate = 60;

// V0: the hub journal pulls from one Ghost instance shared across the village.
// The vendor's own blog content lives on each sister site; this is the village-level journal.
function ghost() {
  return createGhostClient({
    ghostUrl: process.env.HUB_GHOST_URL ?? "http://localhost:2368",
    contentKey: process.env.HUB_GHOST_CONTENT_API_KEY ?? "",
  });
}

export default async function JournalIndexPage() {
  let posts: Post[] = [];
  try {
    posts = await ghost().posts.list({ limit: 20 });
  } catch {
    posts = [];
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

      <ol className="journal__list">
        {posts.length === 0 ? (
          <li className="journal__empty">No posts yet. Check back soon.</li>
        ) : (
          posts.map((post) => (
            <li key={post.slug} className="journal__item">
              <Link href={`/journal/${post.slug}`}>
                <time>{new Date(post.published_at).toLocaleDateString("en-US")}</time>
                <h2>{post.title}</h2>
                {post.excerpt && <p>{post.excerpt}</p>}
              </Link>
            </li>
          ))
        )}
      </ol>
    </main>
  );
}
