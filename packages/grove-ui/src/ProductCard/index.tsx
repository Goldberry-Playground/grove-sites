import type { CSSProperties } from "react";

import { useGroveImage, useGroveLink } from "../link-context";

/** Accent is passed down to CSS via a custom property, so the typed Link seam
 *  (which accepts no `style`) stays untouched. */
type AccentVars = CSSProperties & { "--product-card-accent"?: string };

export interface ProductCardData {
  /** Display name of the product. */
  name: string;
  /** Pre-formatted price string, e.g. "$24.00". */
  priceFormatted: string;
  /** Fully-resolved image URL, or null/undefined to render an empty frame. */
  imageUrl?: string | null;
  /** Destination href for the whole card. */
  href: string;
  /** Vendor display name (eyebrow). */
  vendorName: string;
}

/**
 * Intrinsic size handed to the injected Image. The frame is a 1:1 box
 * (`.product-card__image { aspect-ratio: 1 }`) and the widest card track is
 * ~300 CSS px, so 600 covers 2x displays; a `next/image` adapter resizes from
 * this and `sizes`, a plain `<img>` just reserves the ratio.
 */
export const PRODUCT_CARD_IMAGE_SIZE = 600;

export interface ProductCardProps {
  /** Presentational product data. */
  product: ProductCardData;
  /** Optional editorial pull-quote. */
  editorialNote?: string;
  /**
   * First above-the-fold card in a grid: its photo loads eagerly at high fetch
   * priority (it is the LCP element). Leave unset for every other card so they
   * stay lazy (GOL-3477).
   */
  imagePriority?: boolean;
  /** `sizes` hint for the card photo's responsive srcset, e.g.
   *  `"(max-width: 720px) calc(100vw - 2rem), 300px"`. */
  imageSizes?: string;
  /**
   * Per-vendor accent applied to the bottom border + vendor eyebrow so cards
   * from different vendors are distinguishable in a mixed grid. Prop, not token.
   */
  accentColor?: string;
}

/**
 * Federated product card. Presentational: all data arrives via props, Link and
 * Image are injected through context — no `next/*`, no data fetching. The
 * per-vendor accent stays a prop (inline style), everything else is `--grove-*`.
 */
export function ProductCard({
  product,
  editorialNote,
  accentColor,
  imagePriority,
  imageSizes,
}: ProductCardProps) {
  const Link = useGroveLink();
  const Image = useGroveImage();

  const accentStyle: AccentVars | undefined = accentColor
    ? { "--product-card-accent": accentColor }
    : undefined;

  return (
    <div className="product-card-wrap" style={accentStyle}>
      <Link href={product.href} className="product-card">
        <div className="product-card__image">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={PRODUCT_CARD_IMAGE_SIZE}
              height={PRODUCT_CARD_IMAGE_SIZE}
              sizes={imageSizes}
              priority={imagePriority}
            />
          ) : null}
        </div>
        <div className="product-card__body">
          <div className="product-card__vendor">{product.vendorName}</div>
          <h3 className="product-card__name">{product.name}</h3>
          {editorialNote ? (
            <p className="product-card__editorial">“{editorialNote}”</p>
          ) : null}
          <div className="product-card__price">{product.priceFormatted}</div>
        </div>
      </Link>
    </div>
  );
}
