/**
 * Guide-display block for the GGG (George George George Woodworking)
 * storefront — tenant-parity with the nursery's `GrowingGuide` (GOL-1002 /
 * GOL-986 Part A). The guide narrative lives in this tenant's own Ghost
 * instance, joined by `post.slug === product.slug`. Commerce never blocks on
 * content: when Ghost is down or has no post for the slug, the caller passes
 * `html={null}` and we render the coming-soon collapse.
 *
 * GGG sells woodwork, not plants, so the label is a maker's care/use guide
 * rather than nursery's "Growing guide" — the shared *shape* travels across
 * tenants, the *copy* follows the brand. The HTML is authored in our own Ghost
 * (trusted CMS), the same trust boundary as /blog, so it's injected with
 * `dangerouslySetInnerHTML`.
 *
 * Styling note: uses `text-foreground/70` for the muted coming-soon copy rather
 * than nursery's `text-ink-soft` (that token only resolves in the nursery app).
 * `text-foreground/70` resolves here and clears WCAG AA (≈6.1:1 on bone).
 */
export function GuideBlock({ html }: { html: string | null }) {
  return (
    <section className="grove-guide mt-12" aria-labelledby="guide-heading">
      <h2
        id="guide-heading"
        className="text-lg font-display font-semibold text-foreground mb-4"
      >
        Care &amp; use guide
      </h2>
      {html ? (
        <div
          className="prose prose-sm max-w-none text-foreground/80"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-foreground/70 italic">
          Care guide coming soon — we&rsquo;re writing one for every piece George makes.
        </p>
      )}
    </section>
  );
}
