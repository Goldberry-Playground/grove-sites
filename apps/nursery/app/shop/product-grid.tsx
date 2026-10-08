import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl, withOdooImageSize } from "@grove/odoo-client";
import { CaptureForm, CaptureSlot } from "@grove/ui-kit";
import { ProductImage } from "../product-image";
import { varietyCountLabel } from "../../lib/catalog-labels";
import { showsDealBadge } from "../../lib/deals";

// LCP priming (GOL-2074): mark only the first grid row as `priority` so those
// images get `fetchpriority=high` + a preload link and skip lazy loading — they
// are the above-the-fold LCP candidates on desktop. Everything past the first
// row keeps native lazy loading; priming the whole grid would preload dozens of
// below-fold photos and defeat that. The grid is a fluid `auto-fit
// minmax(280px, 1fr)`; three columns is the reference desktop first row inside
// the sidebar'd shop layout, so three is a conservative "first row" that never
// over-primes a narrower viewport by more than a card or two.
const LCP_PRIORITY_COUNT = 3;

export interface ProductGridProps {
  products: Product[];
  /** Odoo origin, for resolving relative image paths. */
  odooBase: string;
  /**
   * Volume-discount badge text ("5+ save"), or null when the loyalty program
   * has no tiers. Resolved once per page by the caller rather than per card, so
   * one `/promotions/auto` read covers the whole grid.
   */
  dealLabel?: string | null;
  /** Offset into the page's overall card sequence, so the LCP priming and the
   *  stagger animation stay correct when several grids stack (grouped search). */
  indexOffset?: number;
}

/**
 * The /shop card grid (GOL-2745 — extracted from `shop/page.tsx` unchanged, so
 * department pages and grouped search render exactly the same card as the
 * orchard grid rather than growing a near-identical second one).
 *
 * `var-grid--dense` gives phones a 2-up layout (spec § Responsive) while the
 * homepage's editorial grid keeps its 1-up lede card.
 */
export function ProductGrid({
  products,
  odooBase,
  dealLabel = null,
  indexOffset = 0,
}: ProductGridProps) {
  return (
    <div className="var-grid var-grid--dense">
      {products.map((product, gridIndex) => {
        const i = gridIndex + indexOffset;
        // Restock reachability on /shop (GOL-2178). The list endpoint carries no
        // live stock (`available` mirrors website_published, GOL-1896), so the
        // only sold-out signal the grid can see is the preorder cap
        // (`preorderCapReached`) plus the coming-soon placeholder
        // (`saleOk === false`). Either makes the product unavailable → it earns
        // the restock capture.
        const comingSoon = product.saleOk === false;
        const soldOut = !comingSoon && (product.preorderCapReached || !product.available);
        const notifyEligible = comingSoon || soldOut;
        // Deal badge (GOL-2745): only on something you can actually buy today —
        // advertising a volume discount on a sold-out card is a dead end.
        const showsDeal = dealLabel !== null && !soldOut && showsDealBadge(product);
        return (
          <div
            key={product.id}
            className="var-card"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Main clickable area. The restock capture is interactive (a form),
                which is invalid inside an <a>, so the card is a <div> and only
                the image + info sit in the link — the notify disclosure is a
                sibling below it (GOL-2178). */}
            <Link href={`/shop/${product.id}`} className="var-card__link">
              <div className="var-img">
                <ProductImage
                  // The list endpoint hands back thumbnail (image_128) paths;
                  // cards render far larger, so request the 1024px rung and let
                  // next/image downscale it crisply (GOL-761).
                  src={resolveOdooImageUrl(
                    withOdooImageSize(product.imageUrl, 1024),
                    odooBase,
                  )}
                  alt={product.name}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 50vw, 33vw"
                  priority={i < LCP_PRIORITY_COUNT}
                />
                {product.featured && <span className="var-badge">Featured</span>}
                {showsDeal && (
                  // Top-RIGHT so it never collides with "Featured", and the TEXT
                  // carries the meaning — the marigold only draws the eye, so
                  // the badge survives greyscale and every CVD type.
                  <span className="var-badge var-badge--deal">{dealLabel}</span>
                )}
              </div>
              <div className="var-info">
                {product.categoryName && (
                  <span className="var-latin">{product.categoryName}</span>
                )}
                <h3 className="var-name">{product.name}</h3>
                <span className="var-latin">
                  {varietyCountLabel(product.cultivarCount ?? product.variantCount)}
                </span>
                <div className="var-foot">
                  {(() => {
                    // Coming-soon / unpriced: never print "$0.00" — a $0.00
                    // reads as "free" (GOL-408/GOL-1655). The "Coming soon"
                    // badge carries the state; a muted "Price TBD" keeps the
                    // foot row balanced.
                    const priced =
                      typeof product.priceMin === "number"
                        ? product.priceMin
                        : product.price;
                    const isTbd = product.saleOk === false || priced <= 0;
                    return (
                      <span className={`var-price${isTbd ? " var-price--tbd" : ""}`}>
                        {isTbd
                          ? "Price TBD"
                          : typeof product.priceMin === "number"
                            ? `from $${product.priceMin.toFixed(2)}`
                            : `$${product.price.toFixed(2)}`}
                      </span>
                    );
                  })()}
                  {comingSoon ? (
                    <span className="var-stock var-stock--soon">Coming soon</span>
                  ) : (
                    <span
                      className={`var-stock ${soldOut ? "var-stock--out" : "var-stock--in"}`}
                    >
                      {soldOut ? "Sold out" : "In stock"}
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {notifyEligible && (
              // One-CTA-per-page (GOL-2178): registering this restock capture
              // suppresses the shared footer newsletter for the whole page.
              <CaptureSlot priority="restock">
                <details className="var-notify">
                  <summary className="var-notify__toggle">
                    {comingSoon
                      ? "Notify me when it's available"
                      : "Notify me when it's back"}
                  </summary>
                  <div className="var-notify__body">
                    <CaptureForm
                      brand="nursery"
                      source="notify-me"
                      label={`nursery-restock-${product.id}`}
                      interests={["nursery", "restock"]}
                      description="One email when it's ready. That's it."
                      submitLabel="Notify me"
                      successMessage="You're on the list."
                      consentText="We'll only email you about this. Unsubscribe anytime."
                      layout="stacked"
                    />
                  </div>
                </details>
              </CaptureSlot>
            )}
          </div>
        );
      })}
    </div>
  );
}
