import type { CatalogNavNode } from "@grove/odoo-client";
import { facetListLabel } from "../../lib/catalog-nav";
import { NotifyMe } from "./notify-me";

export interface DepartmentTeaserProps {
  dept: CatalogNavNode;
}

/**
 * Coming-soon department page (GOL-2745, spec § Storefront).
 *
 * The honest alternative to an empty grid: say what's coming, say it's not here
 * yet, and offer the one action that's actually available — get told when it
 * is. These pages are also the SEO surface that collects "goldenseal",
 * "ginseng" and "scion wood" traffic before launch, which is why the coming
 * list is real indexable text rather than an image or a JS-rendered list.
 *
 * Design lenses:
 *  • Visual hierarchy — blurb (why care) → what's coming (proof) → notify-me
 *    (the one ask). One primary action on the page, no competing CTA.
 *  • Progressive disclosure — the "Filters when live" note is a SENTENCE, not a
 *    row of disabled controls. A greyed-out filter invites a tap that does
 *    nothing, which reads as broken rather than as forthcoming.
 *  • Gestalt (common region) — the notify card sits on its own panel so the ask
 *    is visually separable from the inventory promise.
 *  • Responsive — stacks on a phone with "what's coming" FIRST, so the reader
 *    gets the substance before the ask; two columns from 768px.
 *  • Ethics — no dark pattern: the waitlist collects an email and nothing else,
 *    and the copy promises exactly one message.
 */
export function DepartmentTeaser({ dept }: DepartmentTeaserProps) {
  const filterNote = facetListLabel(dept.facets);

  return (
    <div className="dept-teaser">
      {dept.teaser && <p className="dept-teaser__blurb">{dept.teaser}</p>}

      <div className="dept-teaser__cols">
        <div>
          {dept.comingList.length > 0 ? (
            <>
              <h3 className="dept-coming__title">What&rsquo;s coming</h3>
              <ul className="dept-coming__list">
                {dept.comingList.map((item) => (
                  <li key={item.name} className="dept-coming__item">
                    <span className="dept-coming__name">{item.name}</span>
                    {item.detail && (
                      <span className="dept-coming__detail">{item.detail}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // Empty state, still styled: a department can be announced before
            // its list is authored in Odoo. Say that plainly rather than
            // rendering a heading over nothing.
            <div className="shop-empty">
              <p>
                We&rsquo;re still settling what goes in this one. The waitlist is
                open either way.
              </p>
            </div>
          )}

          {filterNote && (
            <p className="dept-teaser__filters">
              <strong>Filters when live:</strong> {filterNote}.
            </p>
          )}
        </div>

        <div className="dept-notify">
          <NotifyMe deptSlug={dept.slug} deptName={dept.name} />
        </div>
      </div>
    </div>
  );
}
