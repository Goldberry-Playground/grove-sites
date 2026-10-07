import { notFound } from "next/navigation";
import { isGhostNotFound, type Post } from "@grove/ghost-client";
import { JournalProductEmbed } from "../../../../components/JournalProductEmbed";
import { ghost } from "../../../../lib/ghost";
import { sanitizePostHtml } from "../../../../lib/sanitize";
import { marketplace } from "../../../../data/marketplace";

export const revalidate = 300;

type Params = { slug: string };

export default async function JournalPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  let post: Post | null = null;

  // A 404 is a promise about the RESOURCE, not about our infrastructure
  // (GOL-2803). This route used to catch everything and `notFound()`, so a
  // Ghost outage told the reader — and every crawler, at `revalidate = 300` —
  // that a live essay was permanently gone.
  try {
    // `?? null` mirrors the list route's `?? []`: a 200 with an unexpected body
    // degrades to a clean 404 rather than throwing (GOL-2756).
    post = (await ghost().posts.get(slug)) ?? null;
  } catch (err) {
    // `isGhostNotFound` is duck-typed on name + status, NOT `instanceof`:
    // @grove/ghost-client is src-mapped into four Next apps and a duplicated
    // module instance would silently downgrade every 404 into an error state.
    if (isGhostNotFound(err)) notFound();
    // Anything else is an outage. Let it reach ./error.tsx, which answers with
    // an honest 500 and a retry — rather than dressing it up as a 404.
    throw err;
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
