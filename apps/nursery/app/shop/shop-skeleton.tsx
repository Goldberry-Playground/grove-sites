import type { ReactNode } from "react";
import { Suspense } from "react";

/**
 * /shop pending skeleton (GOL-1111). Shown while a catalog view suspends —
 * most visibly when a shopper taps a category pill (a plain <Link>), which
 * swaps the whole product set. This gives <400ms structural feedback (Doherty
 * Threshold) instead of a frozen page while the server re-fetches Odoo.
 *
 * Facet selects and catalog search push inside a `useTransition`, so React
 * keeps the live grid visible with an inline "Updating…"/"Searching…" cue rather
 * than falling back to this skeleton — the two pending treatments are deliberate.
 *
 * ## Why this is not `app/shop/loading.tsx` any more (GOL-3601)
 * A route-level `loading.tsx` wraps the whole `/shop/[slug]` page in a Suspense
 * boundary, so Next flushed the response headers as 200 before the page had
 * finished asking Odoo whether the product exists. Its later `notFound()` could
 * no longer set the status: every unknown product and department answered
 * 200 with a "Not found" title, a soft 404 (GOL-2875 R5, bisected on GOL-2887).
 * Wrapping only the browse body keeps the skeleton and lets the page decide its
 * status before anything streams.
 *
 * The skeleton is aria-hidden decorative chrome; the aria-live "Loading" note
 * carries the status for assistive tech. Shimmer respects reduced-motion.
 */
export function ShopSkeleton() {
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

/**
 * Suspense boundary for a catalog browse body. `viewKey` must change whenever
 * the product set does (department, category pill, facets): navigations are
 * transitions, and React only shows a fallback during a transition for a
 * boundary it has not rendered before. Keying it gives each catalog view a
 * fresh boundary, so a pill tap shows the skeleton the way `loading.tsx` did.
 */
export function ShopBrowseSuspense({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  return (
    <Suspense key={viewKey} fallback={<ShopSkeleton />}>
      {children}
    </Suspense>
  );
}

/** Stable key for a browse view from its department and search params. */
export function browseViewKey(
  deptSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = Object.keys(searchParams)
    .sort()
    .map((k) => `${k}=${String(searchParams[k])}`)
    .join("&");
  return `${deptSlug}?${params}`;
}
