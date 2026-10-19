import { BOOKS, BOOK_KEYS, bookCounts, bookTitle } from "../../data/recipes";

export const WREATH_SRC = "/images/recipes/goldberry-wreath.webp";
export const MARSHALL_SRC = "/images/recipes/marshall-block-m.webp";

/** "Five community cookbooks, credited as printed", with the Marshall thank-you. */
export function Credits() {
  const counts = bookCounts();
  return (
    <section className="credits page-wrap" aria-labelledby="credits-head">
      <div>
        <span className="about-eyebrow">Where these come from</span>
        <h2 id="credits-head">Five community cookbooks, credited as printed.</h2>
        <p className="fine">
          Every recipe keeps its cook&rsquo;s name and hometown exactly as the book printed them. Where a book
          didn&rsquo;t print a hometown, we say so rather than guess. Anything we couldn&rsquo;t read is marked on the
          recipe.
        </p>
      </div>
      <div>
        <ul className="books">
          {BOOK_KEYS.map((k) => {
            const b = BOOKS[k];
            return (
              <li key={k}>
                <b>{bookTitle(k)}</b>
                <span>
                  {b.by}
                  {b.where ? ` · ${b.where}` : ""}
                </span>
                <em>{counts[k]} recipes</em>
              </li>
            );
          })}
        </ul>
        <aside className="journal-product-embed thanks" aria-label="With thanks">
          <div className="journal-product-embed__caption">With thanks</div>
          <div className="lockup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lockup__wreath" src={WREATH_SRC} alt="Goldberry Grove" width={128} height={123} />
            <span className="lockup__x" aria-hidden="true">
              &times;
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lockup__marshall" src={MARSHALL_SRC} alt="Marshall University" width={132} height={89} />
          </div>
          <p>
            To <strong>Marshall University</strong> for its contribution to this collection, and to the clubs, churches,
            and cooks who wrote these down in the first place.
          </p>
        </aside>
      </div>
    </section>
  );
}
