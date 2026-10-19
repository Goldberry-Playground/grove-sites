/**
 * Recipe-card face for the ProductCard image slot: a ruled index card naming
 * the dish's key nut or fruit, stamped with its book. Replaces the product
 * photo. Each `data-rule` row carries a zero-size baseline probe (`i.bl`) that
 * <RuleSnap> uses to sit the text on a rule. Decorative: the card's own name
 * and eyebrow carry the same facts as text, so the face is aria-hidden.
 */
export function RecipeFace({ stamp, word, grown }: { stamp: string; word: string; grown: boolean }) {
  return (
    <div className="rc-face" aria-hidden="true">
      <p className="rc-face__stamp" data-rule="">
        <i className="bl" />
        {stamp}
      </p>
      <p className="rc-face__word" data-rule="">
        <i className="bl" />
        {word}
      </p>
      {grown ? (
        <p className="rc-face__grown" data-rule="">
          <i className="bl" />
          Grown at the Grove
        </p>
      ) : (
        <p className="rc-face__pad">&nbsp;</p>
      )}
    </div>
  );
}
