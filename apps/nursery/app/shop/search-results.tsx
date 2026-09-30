import Link from "next/link";
import { departmentHref } from "../../lib/catalog-nav";
import type { SearchGroup } from "../../lib/shop-search";
import { ProductGrid } from "./product-grid";

export interface SearchResultsProps {
  groups: SearchGroup[];
  odooBase: string;
  dealLabel: string | null;
  /** The query, echoed in the coming-soon copy so the link's purpose is plain. */
  query: string;
}

/**
 * Grouped cross-department search results (GOL-2745, spec § Storefront).
 *
 * Results are grouped rather than flattened so a shopper can always tell WHERE
 * a hit lives — and, critically, whether it's something they can buy. A
 * coming-soon group carries a "Soon" badge in its heading and renders
 * waitlist cards instead of product cards, because there is no product to link
 * to yet: searching "ginseng" must surface Forest farming without ever looking
 * like ginseng is in stock.
 *
 * Design lenses:
 *  • Gestalt (common region) — each group sits under its own ruled heading, so
 *    proximity does the grouping work without boxes.
 *  • Colour-independence — "Soon" is a word in a bordered badge, and a
 *    coming-soon hit is a visibly different card shape (no image, a link out),
 *    so the distinction survives greyscale and every CVD type.
 *  • Recognition over recall — each heading names the department exactly as the
 *    tab row does, so the grouping maps onto nav the shopper has already seen.
 */
export function SearchResults({
  groups,
  odooBase,
  dealLabel,
  query,
}: SearchResultsProps) {
  // Keep the LCP priming and the card stagger honest across stacked grids.
  let cardsSoFar = 0;

  return (
    <div className="search-groups">
      {groups.map((group) => {
        const isSoon = group.status === "coming_soon";
        const offset = cardsSoFar;
        cardsSoFar += group.products.length;
        const hits = group.products.length + group.comingItems.length;

        return (
          <section key={group.slug} aria-labelledby={`search-group-${group.slug}`}>
            <div className="search-group__head">
              <h3 id={`search-group-${group.slug}`} className="search-group__name">
                {group.name}
              </h3>
              {isSoon && <span className="search-group__soon">Soon</span>}
              <span className="search-group__count">
                {hits === 1 ? "1 match" : `${hits} matches`}
              </span>
            </div>

            {isSoon ? (
              <div className="guild-grid">
                {group.comingItems.map((item) => (
                  <div key={item.name} className="search-soon-card">
                    <p className="search-soon-card__name">{item.name}</p>
                    {item.detail && (
                      <p className="search-soon-card__detail">{item.detail}</p>
                    )}
                    {/* The only honest action for a match with no product
                        record: go to that department's waitlist. */}
                    <Link
                      href={departmentHref(group.slug)}
                      className="search-soon-card__link"
                    >
                      {`Not ready yet — get told when ${item.name} is`}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <ProductGrid
                products={group.products}
                odooBase={odooBase}
                dealLabel={dealLabel}
                indexOffset={offset}
              />
            )}
          </section>
        );
      })}

      {groups.length === 0 && (
        <div className="shop-empty">
          <p>
            Nothing matches <em>&ldquo;{query}&rdquo;</em> anywhere in the shop —{" "}
            <Link href="/shop" className="shop-empty__link">
              clear the search
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
