"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AddToCartButton, StickyAddToCartBar } from "@grove/checkout";
import { ProductImage } from "../../product-image";
import { cultivarOptions, formatOptions, pickVariant } from "../../../lib/variant-select";
import { shippingHintFor } from "../../../lib/shipping-hints";
import { buyStateFor, type StockTone } from "../../../lib/buy-state";

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
}: ProductViewProps) {
  const cultivars = useMemo(() => cultivarOptions(variants), [variants]);
  const [cultivar, setCultivar] = useState<string | null>(cultivars[0] ?? null);
  const formats = useMemo(() => formatOptions(variants, cultivar), [variants, cultivar]);
  const [format, setFormat] = useState<string | null>(formats[0] ?? null);
  // Thumbnail the buyer explicitly clicked; null → follow the selected variant.
  const [pinnedImage, setPinnedImage] = useState<string | null>(null);

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
                      <span className="block text-xs text-foreground/55">
                        {fVariant ? `$${fVariant.price.toFixed(2)}` : ""} · {fHint.fulfillment} ·
                        ships from ~${fHint.fromShipping}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className={`text-sm mb-2 ${STOCK_TONE_CLASS[buy.stockTone]}`}>{buy.stockLabel}</p>

          {buy.showDepositNote && (
            <p className="text-xs text-foreground/60 mb-4">
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

          <p className="mt-4 text-xs text-foreground/55">
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

/** Stock-line colour per tone. Colour only reinforces the words in
 * `buy.stockLabel` — meaning is never carried by colour alone (GOL-678). */
const STOCK_TONE_CLASS: Record<StockTone, string> = {
  "in-stock": "text-green-700",
  reserve: "text-amber-700",
  "sold-out": "text-red-600",
};
