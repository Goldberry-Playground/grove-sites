import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../../../lib/clients";
import { isDataUri } from "../../../lib/is-data-uri";
import { sanitizeGuideHtml } from "../../../lib/sanitize";
import { GuideBlock } from "./guide-block";
import { VariantPicker } from "./variant-picker";
import { StickyAddToCartBar } from "@grove/checkout";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  if (Number.isNaN(productId)) {
    notFound();
  }

  let product: Product | null = null;
  try {
    product = await odoo.products.get(productId);
  } catch {
    // Odoo unreachable or the id is unknown: a 404, never a demo product
    // (GOL-3315). The farm shop shows only what Odoo can actually sell.
    notFound();
  }

  if (!product) notFound();

  // Growing guide from Odoo's eCommerce Description (`website_description`),
  // gated by `grove_guide_ready`. Publish-pipeline v2 makes Odoo the single
  // source of truth for guide prose; Ghost is OFF the product path (GOL-1019 /
  // grove-sites#341, correcting #338's Ghost fallback) — Ghost stays wired for
  // /blog only. Commerce never blocks on content: no prose or gate closed →
  // coming-soon collapse. HTML is sanitized server-side before injection.
  const guideHtml =
    product.guideReady && product.websiteDescription
      ? sanitizeGuideHtml(product.websiteDescription)
      : null;

  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  // Build the absolute image URL only when the product actually has an image
  // path; otherwise leave it empty so we don't store a bare host in the cart
  // (which would fail next/image remotePatterns and 404 on render).
  // Odoo products are paths under /web/image/... so they get prefixed with
  // ODOO_URL. An absolute or `data:` URL passes through unchanged.
  const fullImageUrl = resolveOdooImageUrl(product.imageUrl, odooBase);
  const usePlainImg = isDataUri(fullImageUrl);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/shop"
        className="text-sm text-foreground/60 hover:text-primary transition-colors mb-6 inline-flex items-center gap-1.5"
      >
        {/* Inline SVG, not U+2190: the arrow is outside the loaded fonts and
            painted a tofu box (GOL-3117 / GOL-3123). Decorative; the text is
            the link. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7.5 2.5 4 6l3.5 3.5M4 6h7" />
        </svg>
        Back to Shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-4">
        {/* Product Image */}
        <div className="relative aspect-square bg-secondary/20 rounded-lg overflow-hidden">
          {fullImageUrl && !usePlainImg && (
            <Image
              src={fullImageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          )}
          {fullImageUrl && usePlainImg && (
            // Inline SVG data URI — bypass next/image to avoid optimizer
            // remotePatterns + so the cart receives a `data:` src directly.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fullImageUrl}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {product.featured && (
            <span className="absolute top-3 right-3 bg-accent text-white text-xs font-medium px-2 py-1 rounded">
              Featured
            </span>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            {product.name}
          </h1>

          {product.categoryName && (
            <p className="text-sm text-foreground/50 mb-4">
              {product.categoryName}
            </p>
          )}

          <p className="text-2xl font-bold text-primary mb-6">
            ${product.price.toFixed(2)}
            {product.currency && (
              <span className="text-sm font-normal text-foreground/40 ml-1">
                {product.currency}
              </span>
            )}
          </p>

          {/* Description is HTML (Odoo description_ecommerce, or the escaped
              description_sale fallback) — sanitize before injecting (GOL-2386). */}
          {product.description && (
            <div
              className="prose prose-sm text-foreground/80 mb-6"
              dangerouslySetInnerHTML={{ __html: sanitizeGuideHtml(product.description) }}
            />
          )}

          {product.sku && (
            <p className="text-xs text-foreground/40 mb-4">
              SKU: {product.sku}
            </p>
          )}

          {/* A printed-to-order shirt is never "in stock"; the picker's lead-time
              line says what is true instead (GOL-3315). */}
          {product.fulfillmentRoute !== "printify" && (
            <p className="text-sm mb-6">
              {product.available ? (
                <span className="text-green-700">In stock</span>
              ) : (
                <span className="text-red-600">Out of stock</span>
              )}
            </p>
          )}

          {/* Color then Size (GOL-3315). The picker owns the selection and
              hands the exact variant to the cart; a single-variant product
              shows no pickers. */}
          <div data-add-to-cart-anchor>
            <VariantPicker
              product={product}
              // Cart line items render through next/image which doesn't accept
              // inline data: URIs; pass an empty string in that case so the
              // cart shows the neutral placeholder tile instead of erroring.
              imageUrl={usePlainImg ? "" : fullImageUrl}
            />
          </div>
        </div>
      </div>

      {/* A shirt has no growing guide; the block (and its coming-soon collapse)
          is for the farm's plants only (GOL-3315). */}
      {product.fulfillmentRoute !== "printify" && <GuideBlock html={guideHtml} />}

      {/* The sticky bar cannot know the picker's selection, so it only renders
          when there is nothing to pick (GOL-3315). */}
      {product.variants.length <= 1 && (
        <StickyAddToCartBar
          variantId={
            product.variants.length > 0 ? product.variants[0].id : product.id
          }
          templateId={product.id}
          name={
            product.variants.length > 0 ? product.variants[0].name : product.name
          }
          price={
            product.variants.length > 0 ? product.variants[0].price : product.price
          }
          imageUrl={usePlainImg ? "" : fullImageUrl}
          disabled={!product.available}
        />
      )}
    </div>
  );
}
