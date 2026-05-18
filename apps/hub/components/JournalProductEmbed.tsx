import { ProductCard } from "./ProductCard";
import { fetchProductByVendorSlug } from "../lib/marketplace";
import type { JournalProductLink } from "../data/marketplace";

type Props = {
  link: JournalProductLink;
};

/**
 * Renders a product card inside a journal post. Silently renders nothing if the
 * referenced product no longer exists in the vendor's catalog.
 */
export async function JournalProductEmbed({ link }: Props) {
  const hub = await fetchProductByVendorSlug(link.ref.vendor, link.ref.productSlug);
  if (!hub) return null;
  return (
    <aside className={`journal-product-embed journal-product-embed--${link.position}`}>
      <div className="journal-product-embed__caption">
        Mentioned in this post:
      </div>
      <ProductCard product={hub} />
    </aside>
  );
}
