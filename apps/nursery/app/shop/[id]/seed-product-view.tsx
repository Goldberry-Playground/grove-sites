"use client";

import { useState } from "react";
import type { GrowingFacts, SeedSeason } from "@grove/odoo-client";
import { AddToCartButton, StickyAddToCartBar, type CartSeedReservation } from "@grove/checkout";
import { ProductGallery, galleryThumbs, type ViewImage } from "./product-gallery";
import { SeedPreorderCard, seedCtaLabel, type SeedPack } from "./seed-preorder-card";
import { PolicyLink } from "./policy-link";
import { ZoneCheck } from "./zone-check";
import { AtAGlance } from "./at-a-glance";
import type { ViewVariant } from "./product-view";

export interface SeedProductViewProps {
  productId: number;
  name: string;
  featured: boolean;
  heroImage: string;
  images: ViewImage[];
  variants: ViewVariant[];
  fallbackPrice: number;
  /** Odoo `sale_ok`; false locks the box like a coming-soon tree. */
  saleOk?: boolean;
  /** Null when the backend sent no usable season: nothing is reservable then. */
  seedSeason: SeedSeason | null;
  facts?: GrowingFacts;
}

/**
 * The seed-nut PDP buy box (GOL-3258, seed pre-orders spec). Seeds are a $1
 * pre-order with their own ship window, so none of the tree controls apply:
 * no Farm pickup / Shipped toggle, no USDA zone select, no Format or wave cards,
 * no shipping estimator (seeds ship at the actual label cost, charged when the
 * order ships). What remains is the harvest, the Pack size and the deposit.
 */
export function SeedProductView({
  productId,
  name,
  featured,
  heroImage,
  images,
  variants,
  fallbackPrice,
  saleOk,
  seedSeason,
  facts,
}: SeedProductViewProps) {
  const packs: SeedPack[] = variants
    .map((v) => ({ variantId: v.id, label: v.packSize || v.name, price: v.price }))
    .sort((a, b) => a.price - b.price);
  const [selectedId, setSelectedId] = useState<number | null>(packs[0]?.variantId ?? null);
  const [pinnedImage, setPinnedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const price = selected?.price ?? fallbackPrice;
  const hero = pinnedImage ?? (selected?.imageUrl || null) ?? heroImage;
  const thumbs = galleryThumbs(images, heroImage);

  const season = seedSeason ?? CLOSED_SEASON;
  const reservable = saleOk !== false && season.open && selected != null;
  const ctaLabel = reservable ? seedCtaLabel(season) : "Not taking reservations";
  const seed: CartSeedReservation | undefined = reservable
    ? {
        year: season.year,
        rolledOver: season.rolledOver,
        shipStart: season.shipStart,
        shipEnd: season.shipEnd,
      }
    : undefined;
  const cartVariantId = selected?.id ?? productId;
  const cartName = selected?.name ?? name;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-4">
        <ProductGallery
          name={name}
          featured={featured}
          hero={hero}
          thumbs={thumbs}
          activeUrl={hero}
          onPick={setPinnedImage}
        />

        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-4">{name}</h1>

          <p className="text-2xl font-bold text-primary mb-6">${price.toFixed(2)}</p>

          <SeedPreorderCard
            season={season}
            packs={packs}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setPinnedImage(null);
            }}
          />

          <div data-add-to-cart-anchor className="mt-4">
            <AddToCartButton
              variantId={cartVariantId}
              templateId={productId}
              name={cartName}
              price={price}
              imageUrl={hero}
              disabled={!reservable}
              idleLabel={ctaLabel}
              quantity={quantity}
              onQuantityChange={setQuantity}
              seed={seed}
            />
          </div>

          <p className="mt-4 text-xs text-ink-soft">
            Shipping is the actual label cost, charged with the rest when your order ships.{" "}
            <PolicyLink /> for full shipping terms.
          </p>

          <ZoneCheck zoneMin={facts?.zoneMin ?? null} zoneMax={facts?.zoneMax ?? null} />

          <AtAGlance facts={facts} />
        </div>
      </div>

      <StickyAddToCartBar
        variantId={cartVariantId}
        templateId={productId}
        name={cartName}
        price={price}
        imageUrl={hero}
        disabled={!reservable}
        idleLabel={ctaLabel}
        quantity={quantity}
        seed={seed}
      />
    </>
  );
}

/** Stand-in when the payload carried no usable season: closed, nothing promised. */
const CLOSED_SEASON: SeedSeason = {
  year: 0,
  shipStart: "",
  shipEnd: "",
  orderBy: "",
  rolledOver: false,
  reason: null,
  open: false,
};
