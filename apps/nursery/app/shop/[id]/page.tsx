import Link from "next/link";
import { notFound } from "next/navigation";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../../../lib/clients";
import { ghost } from "../../../lib/ghost";
import { getMockProductById, mockProducts } from "../../../data/mock-products";
import { inferCompanions, toCompanionInput } from "../../../lib/companions";
import { stripVariantCode } from "../../../lib/variant-select";
import { ProductView, type ViewImage, type ViewVariant } from "./product-view";
import { SpecBlock } from "./spec-block";
import { GrowingGuide } from "./growing-guide";
import { CompanionsStrip } from "./companions-strip";
import { ZoneCheck } from "./zone-check";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (Number.isNaN(productId)) notFound();

  const odooBase = process.env.ODOO_URL ?? "http://localhost:8069";

  // Product detail — Odoo first, mock fallback (same seam the shop uses).
  let product: Product | null = null;
  try {
    product = await odoo.products.get(productId);
  } catch {
    product = getMockProductById(productId);
  }
  if (!product) notFound();

  // Catalog for companion inference — best-effort, never blocks the page.
  let catalog: Product[] = [];
  try {
    catalog = (await odoo.products.list({ limit: 40 })).products;
  } catch {
    catalog = mockProducts;
  }
  if (catalog.length === 0) catalog = mockProducts;

  // Growing guide from Ghost, joined by slug (== grove_slug). Commerce never
  // blocks on content: any failure / missing post → coming-soon collapse.
  let guideHtml: string | null = null;
  try {
    const post = await ghost.posts.get(product.slug);
    guideHtml = post?.html ?? null;
  } catch {
    guideHtml = null;
  }

  // Tag-inferred guild companions (shared tags ∩ overlapping zone range).
  const companionIds = new Set(
    inferCompanions(
      toCompanionInput(product),
      catalog.map(toCompanionInput),
    ).map((c) => c.id),
  );
  const companions = catalog.filter((p) => companionIds.has(p.id));

  // Serializable view data — resolve image URLs to absolute on the server.
  const heroImage = resolveOdooImageUrl(product.imageUrl, odooBase);
  const images: ViewImage[] = (product.images ?? []).map((img) => ({
    id: img.id,
    url: resolveOdooImageUrl(img.url, odooBase),
    thumbUrl: resolveOdooImageUrl(img.thumbUrl, odooBase),
  }));
  const variants: ViewVariant[] = product.variants.map((v) => ({
    id: v.id,
    // Drop the leading internal [SKU] Odoo prefixes onto variant names — it is
    // not for customers and leaked into the cart/sticky bar (GOL-678, Bug 2).
    name: stripVariantCode(v.name),
    price: v.price,
    available: v.available,
    qtyAvailable: v.qtyAvailable ?? null,
    cultivar: v.cultivar ?? null,
    format: v.format ?? null,
    shippingTier: v.shippingTier ?? null,
    imageUrl: resolveOdooImageUrl(v.imageUrl, odooBase),
  }));

  // Breadcrumb category trail (GOL-679). Odoo's `categoryName` may arrive as a
  // slash-joined path (e.g. "Plants / Shrubs") — split it into real crumbs so
  // the whole trail uses one separator (›). Drop any segment equal to the
  // product name so a product whose category shares its name doesn't render as
  // "Fig › Fig".
  const categoryCrumbs = (product.categoryName ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== product.name.trim().toLowerCase());

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <nav className="text-sm text-foreground/60 mb-4" aria-label="Breadcrumb">
        <Link href="/shop" className="hover:text-primary transition-colors">
          Shop
        </Link>
        {categoryCrumbs.map((crumb, i) => (
          <span key={`${crumb}-${i}`}>
            <span className="mx-2" aria-hidden="true">›</span>
            <span>{crumb}</span>
          </span>
        ))}
        <span className="mx-2" aria-hidden="true">›</span>
        <span className="text-foreground/80" aria-current="page">
          {product.name}
        </span>
      </nav>

      {product.tags && product.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {product.tags.map((t) => (
            <Link
              key={t}
              href={`/shop?tag=${encodeURIComponent(t)}`}
              className="rounded-full border border-primary/15 bg-secondary/20 px-3 py-1 text-xs text-foreground/70 hover:border-primary/40 transition"
            >
              {t}
            </Link>
          ))}
        </div>
      )}

      <ProductView
        productId={product.id}
        name={product.name}
        featured={product.featured}
        heroImage={heroImage}
        images={images}
        variants={variants}
        fallbackPrice={product.price}
      />

      {product.description && (
        <div className="prose prose-sm max-w-none text-foreground/80 mt-10">
          <p>{product.description}</p>
        </div>
      )}

      <ZoneCheck
        zoneMin={product.facts?.zoneMin ?? null}
        zoneMax={product.facts?.zoneMax ?? null}
      />

      <SpecBlock facts={product.facts} />

      <GrowingGuide html={guideHtml} />

      <CompanionsStrip companions={companions} odooBase={odooBase} />
    </div>
  );
}
