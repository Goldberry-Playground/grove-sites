"use client";

import { useMemo, useState } from "react";
import type { ShippingTier } from "@grove/odoo-client";
import Image from "next/image";
import { AddToCartButton, StickyAddToCartBar } from "@grove/checkout";
import { CaptureForm } from "@grove/ui-kit";
import { ProductImage } from "../../product-image";
import { cultivarOptions, formatOptions, pickVariant } from "../../../lib/variant-select";
import { shippingHintFor } from "../../../lib/shipping-hints";
import { estimateShipping, shipsTo, tierFor } from "../../../lib/shipping-estimate";
import { buyStateFor, type StockTone } from "../../../lib/buy-state";
import { ShippingEstimator, type EstimatorTier } from "./shipping-estimator";

/** Serializable gallery image (URLs pre-resolved to absolute on the server). */
export interface ViewImage {
  id: number;
  url: string;
  thumbUrl: string;
}

/** Serializable variant for the buy box (image URL pre-resolved). */
export interface ViewVariant {
  id: number;
  name: string;
  price: number;
  available: boolean;
  qtyAvailable: number | null;
  cultivar: string | null;
  format: string | null;
  shippingTier: "potted" | "bareroot" | null;
  imageUrl: string;
}

export interface ProductViewProps {
  productId: number;
  name: string;
  featured: boolean;
  heroImage: string;
  images: ViewImage[];
  variants: ViewVariant[];
  /** Product-level price used when the product has no variants. */
  fallbackPrice: number;
  /**
   * Product-level purchasability (Odoo `sale_ok`). `false` on a "coming soon"
   * placeholder — the page renders but the buy box is locked (GOL-760).
   */
  saleOk?: boolean;
}

/**
 * Client buy experience: hero gallery + cultivar dropdown + Potted/Bareroot
 * format selector. Selecting an axis updates the price, exact stock line,
 * landed-cost hint, hero image, and the variant the Add-to-Cart button writes.
 * Selection rules are the pure helpers in `lib/variant-select` (unit tested);
 * this component only wires them to state + presentation.
 */
export function ProductView({
  productId,
  name,
  featured,
  heroImage,
  images,
  variants,
  fallbackPrice,
  saleOk,
}: ProductViewProps) {
  const cultivars = useMemo(() => cultivarOptions(variants), [variants]);
  const [cultivar, setCultivar] = useState<string | null>(cultivars[0] ?? null);
  const formats = useMemo(() => formatOptions(variants, cultivar), [variants, cultivar]);
  const [format, setFormat] = useState<string | null>(formats[0] ?? null);
  // Thumbnail the buyer explicitly clicked; null → follow the selected variant.
  const [pinnedImage, setPinnedImage] = useState<string | null>(null);
  // Destination state for the shipping estimator ("" = not chosen yet).
  const [shipState, setShipState] = useState<string>("");

  // Distinct shipping tiers this product offers, for the state estimator.
  const estimatorTiers = useMemo<EstimatorTier[]>(() => {
    const seen = new Set<ShippingTier>();
    const out: EstimatorTier[] = [];
    for (const f of formats) {
      const v = pickVariant(variants, { cultivar, format: f });
      const tier = tierFor({ shippingTier: v?.shippingTier ?? null, format: f });
      if (seen.has(tier)) continue;
      seen.add(tier);
      const hint = shippingHintFor({ shippingTier: v?.shippingTier ?? null, format: f });
      out.push({ tier, label: TIER_LABEL[tier], fulfillment: hint.fulfillment });
    }
    return out;
  }, [formats, variants, cultivar]);

  const selected = pickVariant(variants, { cultivar, format });
  const price = selected?.price ?? fallbackPrice;
  const variantImage = selected?.imageUrl || null;
  const hero = pinnedImage ?? variantImage ?? heroImage;

  const thumbs: ViewImage[] =
    images.length > 0
      ? images
      : heroImage
        ? [{ id: -1, url: heroImage, thumbUrl: heroImage }]
        : [];

  function chooseCultivar(next: string) {
    setCultivar(next);
    // Keep the current format if the new cultivar offers it, else fall to its first.
    const nextFormats = formatOptions(variants, next);
    if (!format || !nextFormats.includes(format)) setFormat(nextFormats[0] ?? null);
    setPinnedImage(null);
  }

  function chooseFormat(next: string) {
    setFormat(next);
    setPinnedImage(null);
  }

  // One buy-state decision drives the stock line, the CTA, and the sticky bar,
  // so the inline box and the mobile bar can never contradict each other
  // (GOL-678). A sold-out Bareroot is reservable, not dead.
  const buy = buyStateFor({
    available: selected ? selected.available : true,
    qtyAvailable: selected?.qtyAvailable ?? null,
    shippingTier: selected?.shippingTier ?? null,
    format,
    saleOk,
  });

  const cartName = selected?.name ?? name;
  const cartVariantId = selected?.id ?? productId;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-4">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square bg-secondary/20 rounded-lg overflow-hidden">
            <ProductImage
              src={hero}
              alt={name}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
            {featured && (
              <span className="absolute top-3 right-3 bg-accent text-white text-xs font-medium px-2 py-1 rounded">
                Featured
              </span>
            )}
          </div>
          {thumbs.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto" role="list" aria-label="Product images">
              {thumbs.map((img) => {
                const isActive = (pinnedImage ?? variantImage ?? heroImage) === img.url;
                return (
                  <button
                    key={img.id}
                    type="button"
                    role="listitem"
                    onClick={() => setPinnedImage(img.url)}
                    aria-pressed={isActive}
                    aria-label="Show image"
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border transition ${
                      isActive ? "border-primary" : "border-primary/10 hover:border-primary/40"
                    }`}
                  >
                    <Image src={img.thumbUrl} alt="" fill className="object-cover" sizes="64px" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-4">{name}</h1>

          <p className="text-2xl font-bold text-primary mb-6">${price.toFixed(2)}</p>

          {cultivars.length > 0 && (
            <div className="mb-5">
              <label htmlFor="cultivar" className="block text-sm font-semibold text-foreground mb-2">
                Cultivar
              </label>
              <select
                id="cultivar"
                value={cultivar ?? ""}
                onChange={(e) => chooseCultivar(e.target.value)}
                className="w-full rounded border border-primary/20 bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {cultivars.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formats.length > 0 && (
            <div className="mb-5">
              <span className="block text-sm font-semibold text-foreground mb-2">Format</span>
              <div className="flex flex-wrap gap-2">
                {formats.map((f) => {
                  const fVariant = pickVariant(variants, { cultivar, format: f });
                  const fHint = shippingHintFor({
                    shippingTier: fVariant?.shippingTier ?? null,
                    format: f,
                  });
                  // Once a state is picked, echo its exact estimate here. For a
                  // state we don't reach, say so (don't dangle a "from ~$X" the
                  // estimator just said we can't fulfil); otherwise the generic hint.
                  const fTier = tierFor({
                    shippingTier: fVariant?.shippingTier ?? null,
                    format: f,
                  });
                  const fEst = shipState ? estimateShipping(shipState, fTier) : null;
                  const shipText =
                    fEst != null
                      ? `ship $${fEst.toFixed(0)} to ${shipState}`
                      : shipState && !shipsTo(shipState)
                        ? `not shipping to ${shipState} yet`
                        : `ships from ~$${fHint.fromShipping}`;
                  const isActive = f === format;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => chooseFormat(f)}
                      aria-pressed={isActive}
                      className={`rounded border px-4 py-2 text-left text-sm transition ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-primary/15 hover:border-primary/40"
                      }`}
                    >
                      <span className="block font-medium text-foreground">{f}</span>
                      <span className="block text-xs text-ink-soft">
                        {fVariant ? `$${fVariant.price.toFixed(2)}` : ""} · {fHint.fulfillment} ·{" "}
                        {shipText}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {estimatorTiers.length > 0 && (
            <ShippingEstimator
              state={shipState}
              onStateChange={setShipState}
              tiers={estimatorTiers}
            />
          )}

          <p className="text-sm mb-2">
            {/* Badge lives on an inner span: .stock-line is inline-flex (it
                renders the status glyph via ::before), so it must not take
                over the paragraph's block layout. */}
            <span className={STOCK_TONE_CLASS[buy.stockTone]}>{buy.stockLabel}</span>
          </p>

          {buy.showDepositNote && (
            <p className="text-xs text-ink-soft mb-4">
              Bareroot ships in fall — reserve now with a $10 deposit applied to your total.
            </p>
          )}

          <div data-add-to-cart-anchor className="mt-4">
            <AddToCartButton
              variantId={cartVariantId}
              templateId={productId}
              name={cartName}
              price={price}
              imageUrl={hero}
              disabled={buy.ctaDisabled}
              idleLabel={buy.ctaLabel}
            />
          </div>

          {(buy.mode === "sold-out" || buy.mode === "coming-soon") && (
            <div className="mt-6 rounded-lg border border-primary/10 bg-secondary/10 p-5">
              <CaptureForm
                brand="nursery"
                source="notify-me"
                label={`nursery-restock-${productId}`}
                interests={["nursery", "restock"]}
                eyebrow={buy.mode === "coming-soon" ? "Coming soon" : "Back-in-stock alert"}
                heading={
                  buy.mode === "coming-soon"
                    ? "Be the first to know when it's available."
                    : "Want to know when it's back in stock?"
                }
                description="We'll send one email when it's ready to ship — that's it."
                submitLabel="Notify me"
                successMessage="You're on the list. We'll email you when it's ready."
                consentText="We'll only email you about this. Unsubscribe anytime."
              />
            </div>
          )}

          <p className="mt-4 text-xs text-ink-soft">
            Free local pickup Tue–Sat, 10am–7pm. Can’t make those hours? Call us after ordering.
          </p>
        </div>
      </div>

      <StickyAddToCartBar
        variantId={cartVariantId}
        templateId={productId}
        name={cartName}
        price={price}
        imageUrl={hero}
        disabled={buy.ctaDisabled}
        idleLabel={buy.ctaLabel}
      />
    </>
  );
}

/** Stock-line class per tone (GOL-678 buy-state × GOL-682 #4 a11y tokens).
 *  Colour only reinforces the words in `buy.stockLabel` — meaning is never
 *  carried by colour alone: each token also renders a distinct glyph (filled
 *  disc / diamond / hollow disc) and every foreground clears 4.5:1 on all
 *  three parchment surfaces. Do NOT swap these back to raw Tailwind colours;
 *  text-red-600 was 4.06:1 and text-amber-700 is 3.93:1 on paper-deep. */
const STOCK_TONE_CLASS: Record<StockTone, string> = {
  "in-stock": "stock-line stock-line--in",
  reserve: "stock-line stock-line--reserve",
  "sold-out": "stock-line stock-line--out",
};

/** Friendly per-tier label for the shipping estimator rows. */
const TIER_LABEL: Record<ShippingTier, string> = {
  potted: "Potted",
  bareroot: "Bareroot",
};
