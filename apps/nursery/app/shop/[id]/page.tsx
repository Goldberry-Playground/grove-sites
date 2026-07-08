import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../../../lib/clients";
import { getMockProductById } from "../../../data/mock-products";
import { AddToCartButton } from "./add-to-cart-button";
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
    // Odoo unreachable — fall back to mock catalog. Remove when Odoo is live.
    product = getMockProductById(productId);
  }

  if (!product) notFound();

  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";
  // Build the absolute image URL only when the product actually has an image
  // path; otherwise leave it empty so we don't store a bare host in the cart
  // (which would fail next/image remotePatterns and 404 on render).
  //   - Absolute URLs (http/https) pass through.
  //   - Local /products/ and /hero/ paths point at /public assets served by
  //     Next directly — pass through.
  //   - Anything else is treated as an Odoo image path (e.g. /web/image/...)
  //     and prefixed with the Odoo base URL.
  const fullImageUrl = resolveOdooImageUrl(product.imageUrl, odooBase);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link
        href="/shop"
        className="text-sm text-foreground/60 hover:text-primary transition-colors mb-6 inline-block"
      >
        &larr; Back to Shop
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-4">
        {/* Product Image */}
        <div className="relative aspect-square bg-secondary/20 rounded-lg overflow-hidden">
          {fullImageUrl && (
            <Image
              src={fullImageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
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

          {product.description && (
            <div className="prose prose-sm text-foreground/80 mb-6">
              <p>{product.description}</p>
            </div>
          )}

          {product.sku && (
            <p className="text-xs text-foreground/40 mb-4">
              SKU: {product.sku}
            </p>
          )}

          <p className="text-sm mb-6">
            {product.available ? (
              <span className="text-green-700">In stock</span>
            ) : (
              <span className="text-red-600">Out of stock</span>
            )}
          </p>

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Available Options
              </h3>
              <div className="space-y-2">
                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between rounded border border-primary/10 px-3 py-2 text-sm"
                  >
                    <span>{variant.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        ${variant.price.toFixed(2)}
                      </span>
                      <span
                        className={
                          variant.available
                            ? "text-green-700 text-xs"
                            : "text-red-600 text-xs"
                        }
                      >
                        {variant.available ? "In stock" : "Out of stock"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div data-add-to-cart-anchor>
            <AddToCartButton
              variantId={
                product.variants.length > 0 ? product.variants[0].id : product.id
              }
              templateId={product.id}
              name={
                product.variants.length > 0
                  ? product.variants[0].name
                  : product.name
              }
              price={
                product.variants.length > 0
                  ? product.variants[0].price
                  : product.price
              }
              imageUrl={fullImageUrl}
              disabled={!product.available}
            />
          </div>
        </div>
      </div>
      {/* Mobile sticky add-to-cart bar — appears once the inline button
          scrolls out of view. Hidden on >= sm via CSS in the component. */}
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
        imageUrl={fullImageUrl}
        disabled={!product.available}
      />
    </div>
  );
}
