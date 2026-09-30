import Link from "next/link";
import type { CatalogNav } from "@grove/odoo-client";
import { visibleDepartments, departmentHref, GUILDS_SLUG } from "../lib/departments";

export interface DepartmentNavProps {
  /** The tree, already fetched by the page (one fetch per request). */
  nav: CatalogNav;
  /**
   * Slug of the department being viewed — `orchard` on `/shop`. `guilds` marks
   * the Guilds link as current instead of a tab.
   */
  activeSlug: string;
}

/**
 * Department tab row (GOL-2745, spec § Storefront).
 *
 * One quiet row above the category pills: the departments a shopper can browse,
 * plus a right-aligned **Guilds** link. Sits ABOVE `CategoryBar` in the
 * hierarchy — departments are the coarse axis (which family of stock), category
 * pills are the fine one (which kind of tree) — so it uses a heavier, larger
 * type ramp and an underline marker, while the pills keep their filled shape.
 * A stranger should read "tabs, then filters", not "two rows of pills".
 *
 * Design lenses:
 *  • Visual hierarchy — tabs are 15px/600 with a 2px active rule; pills below
 *    are smaller and filled. Two distinct shapes, two distinct jobs.
 *  • Gestalt (common region) — the row sits on its own band with a hairline
 *    under it, so the tabs read as one group separate from the pills.
 *  • Colour-independence — a coming-soon tab carries the word "Soon" in a
 *    bordered badge, and the ACTIVE tab is marked by an underline rule, not a
 *    colour swap. Both survive greyscale and every CVD type.
 *  • Fitts / target size — 44px minimum tap height on every tab and the Guilds
 *    link, per the GOL-2440 standard.
 *  • Responsive — the row scrolls sideways on a phone rather than wrapping, so
 *    the tab set stays one line and the Guilds link stays reachable.
 *
 * Rendered from `/catalog/nav`; `NURSERY_CATEGORIES` in `data/categories.ts` is
 * now only the Orchard department's pill copy, not the whole taxonomy.
 */
export function DepartmentNav({ nav, activeSlug }: DepartmentNavProps) {
  const departments = visibleDepartments(nav);
  // Nothing to choose between → no nav. A single-tab row is chrome that asks
  // the shopper to read a control that can't do anything (Hick's Law, zero
  // options), so the bar only earns its space once a second department exists.
  if (departments.length < 2 && !nav.guilds) return null;

  return (
    <nav className="dept-nav" aria-label="Shop departments">
      <div className="dept-nav__inner">
        <ul className="dept-nav__tabs">
          {departments.map((dept) => {
            const isActive = dept.slug === activeSlug;
            const isSoon = dept.status === "coming_soon";
            return (
              <li key={dept.slug}>
                <Link
                  href={departmentHref(dept.slug)}
                  className="dept-tab"
                  data-active={isActive || undefined}
                  // `aria-current="page"` is the non-visual twin of the
                  // underline rule — screen readers get the active department
                  // without depending on the marker being seen.
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="dept-tab__label">{dept.name}</span>
                  {isSoon && (
                    <span className="dept-tab__soon">
                      {/* Text, not a colour dot: the state must survive
                          greyscale and deuteranopia (spec § Responsive a11y). */}
                      Soon
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {nav.guilds && (
          // Guilds is a right-aligned LINK, not a tab (spec decision 4): a guild
          // can hold products from several departments, so it isn't a peer of
          // the tabs and must not read as one. The leading rule separates it.
          <Link
            href={`/shop/${nav.guilds.slug}`}
            className="dept-nav__guilds"
            data-active={activeSlug === GUILDS_SLUG || undefined}
            aria-current={activeSlug === GUILDS_SLUG ? "page" : undefined}
          >
            <svg
              aria-hidden="true"
              className="dept-nav__guilds-mark"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Three linked rings — "plants that grow better together". A
                  drawn mark, not a glyph: U+2713-class characters tofu in
                  Newsreader (GOL-2734). */}
              <circle cx="5.6" cy="6.2" r="3.1" />
              <circle cx="10.4" cy="6.2" r="3.1" />
              <circle cx="8" cy="10.3" r="3.1" />
            </svg>
            {nav.guilds.name}
          </Link>
        )}
      </div>
    </nav>
  );
}
