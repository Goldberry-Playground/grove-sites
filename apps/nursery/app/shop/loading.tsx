/**
 * /shop route-level pending skeleton (GOL-1111). Shown by Next during a
 * navigation into the catalog that suspends — most visibly when a shopper taps
 * a category pill (a plain <Link>), which swaps the whole product set. This
 * gives <400ms structural feedback (Doherty Threshold) instead of a frozen page
 * while the server re-fetches Odoo.
 *
 * Facet selects and catalog search push inside a `useTransition`, so React
 * keeps the live grid visible with an inline "Updating…"/"Searching…" cue rather
 * than falling back to this skeleton — the two pending treatments are deliberate.
 *
 * The skeleton is aria-hidden decorative chrome; the aria-live "Loading" note
 * carries the status for assistive tech. Shimmer respects reduced-motion.
 */
export default function ShopLoading() {
  return (
    <section className="section" aria-busy="true">
      <div className="section-header">
        <div className="skel skel-heading" aria-hidden="true" />
        <div className="skel skel-tag" aria-hidden="true" />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Loading plants…
      </span>

      <div className="skel skel-search" aria-hidden="true" />

      <div className="flex flex-col md:flex-row gap-8" aria-hidden="true">
        <div className="w-full md:w-56 shrink-0 space-y-6">
          <div className="skel skel-facet" />
          <div className="skel skel-facet" />
          <div className="skel skel-facet" />
        </div>
        <div className="flex-1">
          <div className="var-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skel-card">
                <div className="skel skel-card__img" />
                <div className="skel-card__body">
                  <div className="skel skel-line skel-line--sm" />
                  <div className="skel skel-line skel-line--lg" />
                  <div className="skel skel-line skel-line--sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
