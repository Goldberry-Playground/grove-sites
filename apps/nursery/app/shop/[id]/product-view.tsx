"use client";

import { useMemo, useState } from "react";
import type { ShippingTier, ShippingRateTable, ShippingRateFeed } from "@grove/odoo-client";
import Image from "next/image";
import { AddToCartButton, StickyAddToCartBar } from "@grove/checkout";
import { CaptureForm } from "@grove/ui-kit";
import { ProductImage } from "../../product-image";
import {
  cultivarOptions,
  formatOptions,
  rootstockOptions,
  rootstockKind,
  pickVariant,
} from "../../../lib/variant-select";
import { shippingHintFor } from "../../../lib/shipping-hints";
import {
  estimateTierShipping,
  isPickupOnly,
  PICKUP_ONLY_FULFILLMENT,
  resolveRateTable,
  shipsTo,
  tierFor,
} from "../../../lib/shipping-estimate";
import {
  resolveShippableMode,
  barerootBadge,
  barerootTimingShort,
  barerootNote,
  type FulfillmentResolution,
} from "../../../lib/fulfillment-mode";
import { buyStateFor, type StockTone } from "../../../lib/buy-state";
import { ShippingEstimator, type EstimatorTier } from "./shipping-estimator";
import { PolicyLink } from "./policy-link";

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
  /** Rootstock / propagation axis value (e.g. "M.111", "Seedling"); null when
   *  the product has no Rootstock attribute (GOL-1112). */
  rootstock: string | null;
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
  /**
   * Live shipping-rate table from the backend feed (GOL-969), fetched in the
   * SSR product load. `null` when the feed is unreachable — the estimator then
   * falls back to its bundled snapshot via `resolveRateTable()`.
   */
  shippingRates?: ShippingRateTable | null;
  /**
   * Schema-2 Box Engine v2 feed (GOL-1114), fetched in the SSR product load.
   * Present once the backend is on Box Engine v2; `null` on the legacy backend.
   * When present, bareroot is priced per packed box off this feed; potted keeps
   * its legacy tier behaviour until the pickup-only flip is ratified.
   */
  shippingFeed?: ShippingRateFeed | null;
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
  shippingRates,
  shippingFeed,
}: ProductViewProps) {
  const cultivars = useMemo(() => cultivarOptions(variants), [variants]);
  const [cultivar, setCultivar] = useState<string | null>(cultivars[0] ?? null);
  const formats = useMemo(() => formatOptions(variants, cultivar), [variants, cultivar]);
  const [format, setFormat] = useState<string | null>(formats[0] ?? null);
  const rootstocks = useMemo(() => rootstockOptions(variants, cultivar), [variants, cultivar]);
  const [rootstock, setRootstock] = useState<string | null>(rootstocks[0] ?? null);
  // Thumbnail the buyer explicitly clicked; null → follow the selected variant.
  const [pinnedImage, setPinnedImage] = useState<string | null>(null);
  // Destination state for the shipping estimator ("" = not chosen yet).
  const [shipState, setShipState] = useState<string>("");
  // Chosen quantity, lifted so the inline stepper and the mobile sticky bar add
  // the SAME count — tapping the bar no longer silently adds just 1 (GOL-1055).
  const [quantity, setQuantity] = useState(1);

  // Live backend rate table when available, else the bundled snapshot (GOL-969).
  // resolveRateTable() is drift-safe: null/empty fetch → snapshot, so the
  // estimate degrades gracefully and both the Format cards and the estimator
  // panel below price against the same table.
  const rateTable = useMemo(() => resolveRateTable(shippingRates), [shippingRates]);

  // Which of the three shippable modes bareroot is in TODAY (GOL-1114). Resolved
  // from the schema-2 feed's per-USDA-zone calendar (GOL-1172/1177) against the
  // current date: preorder (deposit now) / ships-now / peat & bagged. Null on the
  // legacy backend (no calendar) — bareroot then keeps its static hint, so the
  // page and checkout stay consistent in both backend generations. Zone-agnostic
  // at the storefront (the season's mode); checkout re-resolves to the shopper's
  // exact USDA zone, which is the authoritative charge and ship window.
  const shipMode = useMemo<FulfillmentResolution | null>(
    () => (shippingFeed?.calendar ? resolveShippableMode(new Date(), shippingFeed.calendar) : null),
    [shippingFeed],
  );

  // Distinct shipping tiers this product offers, for the state estimator.
  const estimatorTiers = useMemo<EstimatorTier[]>(() => {
    const seen = new Set<ShippingTier>();
    const out: EstimatorTier[] = [];
    for (const f of formats) {
      const v = pickVariant(variants, { cultivar, format: f });
      const tier = tierFor({ shippingTier: v?.shippingTier ?? null, format: f });
      if (seen.has(tier)) continue;
      seen.add(tier);
      const pickupOnly = isPickupOnly(tier, shippingFeed);
      const hint = shippingHintFor({ shippingTier: v?.shippingTier ?? null, format: f });
      // Bareroot's timing is date-driven when the calendar feed is live; potted
      // stays pickup-only; the legacy backend keeps the static hint.
      const fulfillment = pickupOnly
        ? PICKUP_ONLY_FULFILLMENT
        : tier === "bareroot" && shipMode
          ? barerootTimingShort(shipMode)
          : hint.fulfillment;
      out.push({
        tier,
        label: TIER_LABEL[tier],
        fulfillment,
        pickupOnly,
        badge: tier === "bareroot" && shipMode ? barerootBadge(shipMode) : null,
      });
    }
    return out;
  }, [formats, variants, cultivar, shippingFeed, shipMode]);

  const selected = pickVariant(variants, { cultivar, format, rootstock });
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
    // Same reconciliation for the rootstock axis: a cultivar sold seedling-only
    // shouldn't keep a "M.111" selection from the previous one (GOL-1112).
    const nextRootstocks = rootstockOptions(variants, next);
    if (!rootstock || !nextRootstocks.includes(rootstock))
      setRootstock(nextRootstocks[0] ?? null);
    setPinnedImage(null);
  }

  function chooseFormat(next: string) {
    setFormat(next);
    setPinnedImage(null);
  }

  function chooseRootstock(next: string) {
    setRootstock(next);
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

  // Selected-format pickup-only flag (Box Engine v2): potted is picked up at the
  // farm, never shipped, so we surface that before the buyer hits checkout — no
  // "ships now" promise the checkout would then block (GOL-1114).
  const selectedTier = tierFor({
    shippingTier: selected?.shippingTier ?? null,
    format,
  });
  const selectedPickupOnly = isPickupOnly(selectedTier, shippingFeed);

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
                  const fPickupOnly = isPickupOnly(fTier, shippingFeed);
                  const fEst =
                    shipState && !fPickupOnly
                      ? estimateTierShipping(shipState, fTier, {
                          feed: shippingFeed,
                          rates: rateTable,
                        })
                      : null;
                  // Pickup-only formats never quote a ship rate; every other
                  // branch is the existing shippable copy.
                  const shipText = fPickupOnly
                    ? "farm pickup only"
                    : fEst != null
                      ? `ship $${fEst.toFixed(0)} to ${shipState}`
                      : shipState && !shipsTo(shipState)
                        ? `not shipping to ${shipState} yet`
                        : `ships from ~$${fHint.fromShipping}`;
                  // Bareroot's timing follows today's shippable mode when the
                  // calendar feed is live (GOL-1114); potted stays pickup-only.
                  const fFulfillment = fPickupOnly
                    ? PICKUP_ONLY_FULFILLMENT
                    : fTier === "bareroot" && shipMode
                      ? barerootTimingShort(shipMode)
                      : fHint.fulfillment;
                  const fBadge =
                    fTier === "bareroot" && shipMode ? barerootBadge(shipMode) : null;
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
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        {f}
                        {fBadge && (
                          <span className="rounded-full border border-primary/25 bg-secondary/15 px-1.5 py-px text-[0.65rem] font-medium text-foreground">
                            {fBadge}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {[
                          fVariant ? `$${fVariant.price.toFixed(2)}` : null,
                          fFulfillment,
                          // Pickup-only formats don't quote a ship line — the
                          // fulfillment already says "Farm pickup only".
                          fPickupOnly ? null : shipText,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rootstock / propagation axis (GOL-1112). A selector only when the
              product genuinely offers a choice (2+ values) — a single-option
              control adds cognitive load without a decision (Hick's Law), so a
              lone rootstock renders as buy-box metadata instead. Colour never
              carries the grafted/seedling meaning: each option pairs a distinct
              glyph with the word, and the label text states it outright. */}
          {rootstocks.length >= 2 && (
            <div className="mb-5">
              <span className="block text-sm font-semibold text-foreground mb-2">Rootstock</span>
              <div className="flex flex-wrap gap-2">
                {rootstocks.map((r) => {
                  const kind = rootstockKind(r);
                  const isActive = r === rootstock;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => chooseRootstock(r)}
                      aria-pressed={isActive}
                      className={`flex items-center gap-2 rounded border px-4 py-2 text-left text-sm transition ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-primary/15 hover:border-primary/40"
                      }`}
                    >
                      <RootstockGlyph kind={kind} />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{r}</span>
                        <span className="block text-xs text-ink-soft">{ROOTSTOCK_KIND_COPY[kind]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {rootstocks.length === 1 && rootstocks[0] && (
            <p className="mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-secondary/10 px-3 py-1 text-xs font-medium text-foreground">
                <RootstockGlyph kind={rootstockKind(rootstocks[0])} />
                {rootstockCopy(rootstocks[0])}
              </span>
            </p>
          )}

          {estimatorTiers.length > 0 && (
            <ShippingEstimator
              state={shipState}
              onStateChange={setShipState}
              tiers={estimatorTiers}
              rates={rateTable}
              feed={shippingFeed}
            />
          )}

          <p className="text-sm mb-2">
            {/* Badge lives on an inner span: .stock-line is inline-flex (it
                renders the status glyph via ::before), so it must not take
                over the paragraph's block layout. */}
            <span className={STOCK_TONE_CLASS[buy.stockTone]}>{buy.stockLabel}</span>
          </p>

          {/* Bareroot fulfillment note, driven by today's shippable mode
              (GOL-1114): preorder + $10 deposit / ships-now / peat & bagged.
              Ratified copy (GOL-1302, flat $10). Icon + words, never colour
              alone. The legacy backend (no calendar feed → shipMode null) keeps
              the old stock-driven deposit note below. */}
          {shipMode && selectedTier === "bareroot" && !selectedPickupOnly && (
            <p className="mb-4 flex items-start gap-1.5 text-xs text-ink-soft">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-secondary"
              >
                <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.5 3.6L12 11.5 5.5 7.9 12 4.3ZM5 9.6l6 3.3v6.2l-6-3.3V9.6Zm14 0v6.2l-6 3.3v-6.2l6-3.3Z" />
              </svg>
              <span>
                {barerootBadge(shipMode) && (
                  <strong className="font-semibold text-foreground">
                    {barerootBadge(shipMode)}.
                  </strong>
                )}{" "}
                {barerootNote(shipMode)}
              </span>
            </p>
          )}

          {buy.showDepositNote && !shipMode && (
            <p className="text-xs text-ink-soft mb-4">
              Bareroot ships in fall — reserve now with a $10 deposit applied to your total.
            </p>
          )}

          {selectedPickupOnly && (
            // Icon + words (never colour alone): potted is farm pickup only.
            // Inline SVG pin (not a unicode glyph) so it renders on every font.
            <p className="mb-4 flex items-start gap-1.5 text-xs text-ink-soft">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-secondary"
              >
                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
              </svg>
              <span>
                <strong className="font-semibold text-foreground">Farm pickup only.</strong>{" "}
                Potted trees aren’t shipped — pick yours up free at the farm. Bareroot
                ships to your door in fall.
              </span>
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
              quantity={quantity}
              onQuantityChange={setQuantity}
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
          <p className="mt-1 text-xs text-ink-soft">
            Ships to 21 states, priced live at checkout. <PolicyLink /> for full
            shipping and warranty terms.
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
        quantity={quantity}
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

/** Secondary descriptor under each rootstock option's raw value (GOL-1112). */
const ROOTSTOCK_KIND_COPY: Record<"grafted" | "seedling", string> = {
  grafted: "Grafted onto clonal rootstock",
  seedling: "Own-root seedling, ungrafted",
};

/**
 * Human copy for a lone rootstock rendered as buy-box metadata. Grafted values
 * name the rootstock ("Grafted on M.111"); a value that already says "graft"
 * passes through. Seedlings read "· own-root" unless the value already says so.
 */
function rootstockCopy(value: string): string {
  if (rootstockKind(value) === "seedling") {
    return /own[\s-]?root/i.test(value) ? value : `${value} · own-root`;
  }
  return /graft/i.test(value) ? value : `Grafted on ${value}`;
}

/**
 * Grafted vs seedling glyph. The two shapes differ (a banded graft union vs a
 * sprouting seedling) so the distinction survives greyscale and every
 * colour-vision type — colour is never the signal (colour-independence lens,
 * GOL-1112). Decorative: aria-hidden, since the adjacent text states the kind.
 */
function RootstockGlyph({ kind }: { kind: "grafted" | "seedling" }) {
  return kind === "seedling" ? (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-primary"
      aria-hidden="true"
    >
      {/* stem + two sprouting leaves */}
      <path d="M8 14V7" />
      <path d="M8 8.5C8 6.5 6.3 5 4.3 5 4.3 7 5.9 8.5 8 8.5Z" />
      <path d="M8 7.5C8 5.7 9.6 4.3 11.5 4.3 11.5 6.1 9.9 7.5 8 7.5Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-primary"
      aria-hidden="true"
    >
      {/* two stems joined by a graft-union band */}
      <path d="M8 2v4" />
      <path d="M8 10v4" />
      <rect x="4.5" y="6" width="7" height="4" rx="1" />
    </svg>
  );
}
