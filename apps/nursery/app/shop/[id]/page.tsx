import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl } from "@grove/odoo-client";
import { odoo } from "../../../lib/clients";
import { buildPdpMetadata, notFoundMetadata } from "../../../lib/pdp-metadata";
import { getMockProductById, mockProducts } from "../../../data/mock-products";
import { sanitizeGuideHtml } from "../../../lib/sanitize";
import { inferCompanions, toCompanionInput } from "../../../lib/companions";
import { stripVariantCode } from "../../../lib/variant-select";
import { ProductView, type ViewImage, type ViewVariant } from "./product-view";
import { SpecBlock } from "./spec-block";
import { ProductDescription } from "./product-description";
import { GrowingGuide } from "./growing-guide";
import { CompanionsStrip } from "./companions-strip";
import { ZoneCheck } from "./zone-check";

export const dynamic = "force-dynamic";

function odooBaseUrl(): string {
  return process.env.ODOO_URL ?? "http://localhost:8069";
}

/**
 * Product detail — Odoo first, mock fallback (same seam the shop uses).
 *
 * `cache()`-wrapped because `generateMetadata` and the page component both
 * need the product and Next runs them in the same request. Without it this
 * route would make two full detail round-trips to the single Odoo droplet per
 * page view: `dynamic = "force-dynamic"` sets `fetchCache: "force-no-store"`,
 * so the client's own `next.revalidate` cannot dedupe them. React's per-request
 * memoization does, and it also guarantees the title and the <h1> describe the
 * same product even if the catalog changes mid-render.
 */
const loadProduct = cache(async (productId: number): Promise<Product | null> => {
  try {
    return await odoo.products.get(productId);
  } catch {
    return getMockProductById(productId);
  }
});

/**
 * Per-product title, description, canonical and share card (GOL-2878 Phase 1).
 *
 * Until this landed, all 21 published PDPs served `<title>At The Grove
 * Nursery</title>` and one shared description, and the site emitted no `og:`
 * tags at all — so every catalog link posted to email or social rendered as a
 * bare URL with no preview (GOL-2875 §1b/§1c).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const productId = Number(id);
  if (Number.isNaN(productId)) return notFoundMetadata();

  const product = await loadProduct(productId);
  if (!product) return notFoundMetadata();

  return buildPdpMetadata({
    product,
    // Phase 1: the id form is the only form, so it is its own canonical. Phase 2
    // introduces `/shop/<slug>` as canonical and 301s this path to it
    // (GOL-2875 R1/R8) — swap this one argument then.
    canonicalPath: `/shop/${product.id}`,
    odooBase: odooBaseUrl(),
  });
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (Number.isNaN(productId)) notFound();

  const odooBase = odooBaseUrl();

  const product = await loadProduct(productId);
  if (!product) notFound();

  // Catalog for companion inference — best-effort, never blocks the page.
  let catalog: Product[] = [];
  try {
    catalog = (await odoo.products.list({ limit: 40 })).products;
  } catch {
    catalog = mockProducts;
  }
  if (catalog.length === 0) catalog = mockProducts;

  // Live shipping data. Two feeds share one endpoint by schema version:
  //   • rates()    — legacy tier-keyed table (schema 1); null once the backend
  //                  is on Box Engine v2. Drives the potted/bareroot snapshot.
  //   • rateFeed() — schema-2 Box Engine v2 feed (box-keyed zones + packing
  //                  catalog); null on the legacy backend. Drives the per-box
  //                  estimate for BOTH tiers, and carries the pickup-only truth:
  //                  potted reads as pickup-only only while the feed prices no
  //                  potted box (GOL-1114, re-opened by GOL-2199 / #813).
  // Exactly one is non-null on a configured backend; both null → the client's
  // bundled snapshot. Best-effort and drift-safe — neither call ever blocks.
  //
  // zoneMap() carries the LIVE state→zone map + green list, present in BOTH schema
  // generations (GOL-2292). It's the fix for the PDP-vs-checkout drift: without it
  // the estimator resolves *which zone* a state is in from the baked snapshot, so
  // a backend re-zoning (e.g. TN → zone_7) repriced checkout but not the PDP until
  // a storefront rebuild. All three hit the same cached endpoint, so Next dedupes
  // the fetch — no extra backend round-trip.
  const [shippingRates, shippingFeed, shippingZoneMap] = await Promise.all([
    odoo.shipping.rates(),
    odoo.shipping.rateFeed(),
    odoo.shipping.zoneMap(),
  ]);

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
    rootstock: v.rootstock ?? null,
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
      <nav className="text-sm text-ink-soft mb-4" aria-label="Breadcrumb">
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
        saleOk={product.saleOk}
        preorderCapReached={product.preorderCapReached}
        // Farm-pickup-only override (GOL-2587 P1 / GOL-2588).
        pickupOnly={product.pickupOnly}
        // Per-item plant-health carve-out inputs (GOL-2973). The green-list gate
        // alone used to decide the estimator's copy, so a PDP cheerfully promised
        // "We ship to Florida" for a chestnut the checkout carve-out gate refuses
        // — advertise-then-reject. The estimator now needs BOTH the declared
        // taxon the gate keys on and the exemption that makes the gate skip, so
        // `complianceExempt` is threaded after all (GOL-2588 left it out when the
        // only notice was the green list, which the exemption does not widen).
        botanicalName={product.facts?.botanicalName ?? null}
        complianceExempt={product.complianceExempt}
        shipsAllGreenStates={product.shipsAllGreenStates}
        // Consult-built mix (GOL-3019 / GOL-3028): the deposit now goes through
        // for FL/IN/OH/WI, so the estimator discloses the per-state constraint
        // instead of the old blanket "we can't confirm this mix".
        consultBuilt={product.consultBuilt}
        shippingRates={shippingRates}
        shippingFeed={shippingFeed}
        shippingZoneMap={shippingZoneMap}
      />

      <ProductDescription html={product.description} />

      <ZoneCheck
        zoneMin={product.facts?.zoneMin ?? null}
        zoneMax={product.facts?.zoneMax ?? null}
      />

      <GrowingGuide html={guideHtml} />

      <SpecBlock facts={product.facts} />

      <CompanionsStrip companions={companions} odooBase={odooBase} />
    </div>
  );
}
