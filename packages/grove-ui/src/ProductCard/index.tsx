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

export interface ProductCardProps {
  /** Presentational product data. */
  product: ProductCardData;
  /** Optional editorial pull-quote. */
  editorialNote?: string;
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
export function ProductCard({ product, editorialNote, accentColor }: ProductCardProps) {
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
            <Image src={product.imageUrl} alt={product.name} />
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
