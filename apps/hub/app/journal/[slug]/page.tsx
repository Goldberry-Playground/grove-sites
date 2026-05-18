import { notFound } from "next/navigation";
import { createGhostClient, type Post } from "@grove/ghost-client";
import { JournalProductEmbed } from "../../../components/JournalProductEmbed";
import { sanitizePostHtml } from "../../../lib/sanitize";
import { marketplace } from "../../../data/marketplace";

export const revalidate = 300;

type Params = { slug: string };

function ghost() {
  return createGhostClient({
    ghostUrl: process.env.HUB_GHOST_URL ?? "http://localhost:2368",
    contentKey: process.env.HUB_GHOST_CONTENT_API_KEY ?? "",
  });
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  let post: Post | null = null;

  try {
    post = await ghost().posts.get(slug);
  } catch {
    post = null;
  }
  if (!post) notFound();

  // Sanitize CMS-authored HTML server-side. See lib/sanitize.ts for the
  // sanitize-html allowlist (tags, attrs, schemes). The dangerouslySetInnerHTML
  // call below is safe because every byte routed into it has passed through
  // that allowlist first. Do not add additional escaping here.
  const safeHtml = sanitizePostHtml(post.html);

  const links = marketplace.journalLinks.filter((l) => l.postSlug === slug);
  const inlineLinks = links.filter((l) => l.position === "inline");
  const sidebarLinks = links.filter((l) => l.position === "sidebar");
  const footerLinks = links.filter((l) => l.position === "footer");

  return (
    <main className="journal-post">
      <header className="journal-post__head">
        <time>{new Date(post.published_at).toLocaleDateString("en-US")}</time>
        <h1>{post.title}</h1>
      </header>

      <div className="journal-post__layout">
        <article className="journal-post__body">
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
          {inlineLinks.map((link, i) => (
            <JournalProductEmbed key={i} link={link} />
          ))}
        </article>

        {sidebarLinks.length > 0 && (
          <aside className="journal-post__sidebar">
            {sidebarLinks.map((link, i) => (
              <JournalProductEmbed key={i} link={link} />
            ))}
          </aside>
        )}
      </div>

      {footerLinks.length > 0 && (
        <footer className="journal-post__related">
          <h3>Related from the village shop</h3>
          {footerLinks.map((link, i) => (
            <JournalProductEmbed key={i} link={link} />
          ))}
        </footer>
      )}
    </main>
  );
}
