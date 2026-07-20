/**
 * Growing-guide section (design spec §"Ghost contract"). The guide narrative
 * lives in the nursery tenant's Ghost, joined by `post.slug === product.slug`.
 * Commerce never blocks on content: when Ghost is down or has no post for the
 * slug, the caller passes `html={null}` and we render the coming-soon collapse.
 *
 * The HTML is authored in our own Ghost instance (trusted CMS, agent/Wesley
 * mediated), the same trust boundary as the /blog renderer — so it's injected
 * with `dangerouslySetInnerHTML`, consistent with how the blog page renders
 * Ghost content.
 */
export function GrowingGuide({ html }: { html: string | null }) {
  return (
    <section className="mt-12" aria-labelledby="guide-heading">
      <h2 id="guide-heading" className="text-lg font-display font-semibold text-foreground mb-4">
        Growing guide
      </h2>
      {html ? (
        <div
          className="prose prose-sm max-w-none text-foreground/80"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-foreground/50 italic">
          Growing guide coming soon — we’re writing one for every species.
        </p>
      )}
    </section>
  );
}
