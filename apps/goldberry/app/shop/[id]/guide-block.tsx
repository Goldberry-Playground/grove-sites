/**
 * Guide-display block for the Goldberry storefront — tenant-parity with the
 * nursery's `GrowingGuide` (GOL-1002 / GOL-986 Part A). The guide narrative
 * lives in this tenant's own Ghost instance, joined by `post.slug ===
 * product.slug`. Commerce never blocks on content: when Ghost is down or has
 * no post for the slug, the caller passes `html={null}` and we render the
 * coming-soon collapse.
 *
 * The HTML is authored in our own Ghost (trusted CMS, agent/Wesley mediated) —
 * the same trust boundary as the /blog renderer — so it's injected with
 * `dangerouslySetInnerHTML`, consistent with how the blog page renders Ghost.
 *
 * Styling note: this deliberately does NOT use nursery's `text-ink-soft`
 * utility — that token only resolves in the nursery app (which is on the
 * @grove/tokens contract). Goldberry's globals still map colors as raw hex, so
 * the muted coming-soon copy uses `text-foreground/70`, which resolves here and
 * clears WCAG AA (≈5.2:1 on Ivory Mist).
 */
export function GuideBlock({ html }: { html: string | null }) {
  return (
    <section className="grove-guide mt-12" aria-labelledby="guide-heading">
      <h2
        id="guide-heading"
        className="text-lg font-display font-semibold text-foreground mb-4"
      >
        Growing guide
      </h2>
      {html ? (
        <div
          className="prose prose-sm max-w-none text-foreground/80"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-foreground/70 italic">
          Growing guide coming soon — we&rsquo;re writing one for every plant we grow.
        </p>
      )}
    </section>
  );
}
