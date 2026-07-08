import { useGroveLink } from "../link-context";

export interface CategoryBarItem {
  /** Stable id / slug (used as React key). */
  slug: string;
  /** Visible label. */
  label: string;
  /** Destination, e.g. `/shop?cat=apple`. */
  href: string;
  /** Live product count shown after the label, e.g. `Apple · 12`. Omit to hide. */
  count?: number;
}

export interface CategoryBarProps {
  /** Category links with their live counts. */
  items: CategoryBarItem[];
  /** Leading "all" link config. */
  allItem: CategoryBarItem;
  /**
   * Trailing standalone link (e.g. Wholesale) with no count and no active state.
   * Optional.
   */
  trailing?: Pick<CategoryBarItem, "label" | "href">;
  /**
   * The href of the active category, supplied by the app. The matching link
   * (including the "all" link when its href matches) renders highlighted.
   */
  activeHref?: string;
}

/** Render a label with an optional ` · count` suffix. */
function itemLabel(label: string, count?: number): string {
  return count === undefined ? label : `${label} · ${count}`;
}

/**
 * Horizontal category nav. All data (labels, counts, hrefs, active state) is
 * supplied by the app via props — no Odoo fetch, no `next/*`. The Link comes
 * from context; styling lives in `CategoryBar.css` against `--grove-*` tokens.
 */
export function CategoryBar({ items, allItem, trailing, activeHref }: CategoryBarProps) {
  const Link = useGroveLink();
  const allActive = allItem.href === activeHref;

  return (
    <nav className="cat-bar" aria-label="Browse the catalog by category">
      <Link
        href={allItem.href}
        className={allActive ? "is-active" : ""}
        aria-current={allActive ? "page" : undefined}
      >
        {itemLabel(allItem.label, allItem.count)}
      </Link>
      {items.map((category) => {
        const isActive = category.href === activeHref;
        return (
          <Link
            key={category.slug}
            href={category.href}
            className={isActive ? "is-active" : ""}
            aria-current={isActive ? "page" : undefined}
          >
            {itemLabel(category.label, category.count)}
          </Link>
        );
      })}
      {trailing ? <Link href={trailing.href}>{trailing.label}</Link> : null}
    </nav>
  );
}
