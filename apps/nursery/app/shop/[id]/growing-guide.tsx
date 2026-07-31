/**
 * Growing-guide section. The guide narrative comes from Odoo's eCommerce
 * Description (`website_description`), gated by `grove_guide_ready` — under
 * publish-pipeline v2 Odoo is the single source of truth for guide prose and
 * Ghost is off the product path (GOL-1019 / grove-sites#341, correcting #338's
 * Ghost fallback). Commerce never blocks on content: when the gate is closed or
 * there is no prose, the caller passes `html={null}` and we render the
 * coming-soon collapse.
 *
 * The caller sanitizes the Odoo HTML server-side (see `lib/sanitize.ts`) before
 * passing it here, so `html` is a trusted, allowlisted string injected with
 * `dangerouslySetInnerHTML` — the same trust boundary as the /blog renderer.
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
        <p className="text-sm text-ink-soft italic">
          Growing guide coming soon — we’re writing one for every species.
        </p>
      )}
    </section>
  );
}
