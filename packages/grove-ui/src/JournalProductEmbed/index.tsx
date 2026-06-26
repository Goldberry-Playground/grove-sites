import { ProductCard, type ProductCardData } from "../ProductCard";

export interface JournalProductEmbedProps {
  /** Resolved product data for the embedded card. */
  product: ProductCardData;
  /** Placement within the journal post — drives a layout modifier class. */
  position: "inline" | "sidebar" | "footer";
  /** Per-vendor accent forwarded to the embedded ProductCard (prop, not token). */
  accentColor?: string;
  /** Caption above the card. Defaults to the canonical phrasing. */
  caption?: string;
}

/**
 * Renders a product card inside a journal post. Presentational: the product is
 * passed in (no data fetching), Link/Image come via ProductCard's injected
 * context. Styled against `--grove-*`.
 */
export function JournalProductEmbed({
  product,
  position,
  accentColor,
  caption = "Mentioned in this post:",
}: JournalProductEmbedProps) {
  return (
    <aside className={`journal-product-embed journal-product-embed--${position}`}>
      <div className="journal-product-embed__caption">{caption}</div>
      <ProductCard product={product} accentColor={accentColor} />
    </aside>
  );
}
