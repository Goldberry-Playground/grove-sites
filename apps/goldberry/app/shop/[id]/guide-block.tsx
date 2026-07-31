/**
 * Guide-display block for the Goldberry storefront — tenant-parity with the
 * nursery's `GrowingGuide` (GOL-1002 / GOL-986 Part A). The guide narrative
 * comes from Odoo's eCommerce Description (`website_description`), gated by
 * `grove_guide_ready` — under publish-pipeline v2 Odoo is the single source of
 * truth for guide prose and Ghost is off the product path (GOL-1019 /
 * grove-sites#341, correcting #338's Ghost fallback). Commerce never blocks on
 * content: when the gate is closed or there is no prose, the caller passes
 * `html={null}` and we render the coming-soon collapse.
 *
 * The caller sanitizes the Odoo HTML server-side (see `lib/sanitize.ts`) before
 * passing it here, so `html` is a trusted, allowlisted string injected with
 * `dangerouslySetInnerHTML` — the same trust boundary as the /blog renderer.
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
