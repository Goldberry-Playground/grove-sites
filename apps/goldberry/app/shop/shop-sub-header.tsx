"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SHOP_CATEGORIES } from "../../data/mock-products";

/**
 * Editorial shop sub-header. Sits beneath the global brand-header and above
 * every /shop route. Categories drive a `?cat=<slug>` query on the list
 * page; on a detail page they link back to the list page filtered.
 *
 * Styling tokens come from globals.css — `.about-eyebrow` for the mono
 * eyebrow, `--chestnut-reserve` / `--harvest-gold` / `--forest-command` for
 * the editorial palette.
 */
export function ShopSubHeader() {
  const pathname = usePathname() ?? "/shop";
  const searchParams = useSearchParams();
  const activeCat = (searchParams?.get("cat") ?? "all").toLowerCase();
  const onDetail = /^\/shop\/[^/]+$/.test(pathname);

  return (
    <section className="shop-subheader" aria-label="Shop section">
      <div className="shop-subheader__inner">
        <div className="shop-subheader__head">
          <span className="about-eyebrow">The Goldberry Shop</span>
          <h1 className="shop-subheader__title">
            Small-batch goods <em>from the hillside</em>
          </h1>
          <p className="shop-subheader__lede">
            Chestnut flour, freeze-dried Appalachian fruit, jams, and
            inoculation kits — rendered from what the grove grew this season.
          </p>
        </div>
        <nav className="shop-subheader__nav" aria-label="Product categories">
          <ul role="list">
            {SHOP_CATEGORIES.map((cat) => {
              const isActive = onDetail ? false : cat.id === activeCat;
              const href = cat.id === "all" ? "/shop" : `/shop?cat=${cat.id}`;
              return (
                <li key={cat.id}>
                  <Link
                    href={href}
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
