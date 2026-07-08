import type { ReactNode } from "react";
import { useGroveLink } from "../link-context";

export interface ShopCategory {
  /** Stable id (used as React key). */
  id: string;
  /** Visible pill label. */
  label: string;
  /** Destination the pill links to, e.g. `/shop` or `/shop?cat=jams`. */
  href: string;
}

export interface ShopSubHeaderProps {
  /** Mono eyebrow above the title. */
  eyebrow: string;
  /** Section title. Pass JSX to emphasize a span (rendered in accent italic). */
  title: ReactNode;
  /** Supporting lede paragraph. */
  lede: ReactNode;
  /** Category pills. */
  categories: ShopCategory[];
  /**
   * The href of the currently active category, supplied by the app (which knows
   * the route + query). The matching pill renders highlighted. Omit on detail
   * pages so no pill is active.
   */
  activeHref?: string;
}

/**
 * Editorial shop sub-header: eyebrow + title + lede + a row of category pills.
 * Navigation state arrives as `activeHref` (no `usePathname`/`useSearchParams`),
 * and the Link comes from context (no `next/link`). Styling lives in
 * `ShopSubHeader.css` against `--grove-*` tokens.
 */
export function ShopSubHeader({
  eyebrow,
  title,
  lede,
  categories,
  activeHref,
}: ShopSubHeaderProps) {
  const Link = useGroveLink();

  return (
    <section className="shop-subheader" aria-label="Shop section">
      <div className="shop-subheader__inner">
        <div className="shop-subheader__head">
          <span className="about-eyebrow">{eyebrow}</span>
          <h1 className="shop-subheader__title">{title}</h1>
          <p className="shop-subheader__lede">{lede}</p>
        </div>
        <nav className="shop-subheader__nav" aria-label="Product categories">
          <ul role="list">
            {categories.map((cat) => {
              const isActive = cat.href === activeHref;
              return (
                <li key={cat.id}>
                  <Link
                    href={cat.href}
                    className={`shop-subheader__pill${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {cat.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </section>
  );
}
