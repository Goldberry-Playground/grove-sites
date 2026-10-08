"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  GrowingFacts,
  ShipWave,
  ShippingTier,
  ShippingRateTable,
  ShippingRateFeed,
  ShippingZoneMap,
} from "@grove/odoo-client";
import Image from "next/image";
import { AddToCartButton, StickyAddToCartBar } from "@grove/checkout";
import { CaptureForm, CaptureSlot } from "@grove/ui-kit";
import { ProductImage } from "../../product-image";
import {
  cultivarOptions,
  formatOptions,
  rootstockOptions,
  rootstockKind,
  pickVariant,
  variantMatches,
  defaultCultivar,
  defaultFormat,
  defaultRootstock,
} from "../../../lib/variant-select";
import { shippingHintFor } from "../../../lib/shipping-hints";
import {
  estimateTierShipping,
  shipScope,
  hasBoxFeed,
  estimateTierFloor,
  isPickupOnly,
  PICKUP_ONLY_FULFILLMENT,
  resolveRateTable,
  resolveZoneMap,
  shipsTo,
  tierFor,
} from "../../../lib/shipping-estimate";
import {
  resolveShippableMode,
  tierFulfillment,
  type FulfillmentResolution,
} from "../../../lib/fulfillment-mode";
import { buyStateFor, type StockTone } from "../../../lib/buy-state";
import { readFulfillmentPref, writeFulfillmentPref } from "../../../lib/fulfillment-pref";
import {
  formatsForMethod,
  isPottedSeason,
  methodFormatLabel,
  type FulfillmentMethod,
} from "../../../lib/fulfillment-method";
import {
  farmZoneOf,
  firstOpenWave,
  isPreorderSeason,
  pickupWaves,
  preorderWaves,
  readUsdaZone,
  waveZones,
  writeUsdaZone,
} from "../../../lib/preorder-waves";
import { PreorderCard } from "./preorder-card";
import { RadioDot, optionCardClass } from "./option-card";
import { ShippingEstimator, type EstimatorTier } from "./shipping-estimator";
import {
  evaluateCompliance,
  resolveCompliance,
  resolveSubstitutes,
} from "../../../lib/plant-compliance";
import { PolicyLink } from "./policy-link";
import { ZoneCheck } from "./zone-check";
import { AtAGlance, PlantTwoHint } from "./at-a-glance";
import { PLANT_TWO_QUANTITY } from "../../../lib/plant-two";

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
   * Preorder cap reached (Odoo `grove_preorder_cap_reached`, GOL-2171). `true`
   * once the per-product reservation cap is crossed — the buy box flips to a
   * hard sell-out with a restock capture, even for a preorder (Bareroot)
   * format. Optional/defaulted to uncapped so older payloads are unaffected.
   */
  preorderCapReached?: boolean;
  /**
   * Farm-pickup-only override (Odoo `grove_pickup_only`, GOL-2587 P1 hotfix;
   * rendered GOL-2588). `true` when this product must never ship, whatever its
   * shipping tier: every Format reads "Farm pickup only", the state estimator is
   * hidden (there is no rate to estimate), the buy button reserves for pickup,
   * and the cart line carries the flag so checkout locks fulfillment to pickup.
   * This is the SAME treatment potted stock gets under Box Engine v2 (GOL-1114),
   * reached through the same `isPickupOnly` seam so the two can never drift.
   * Optional/defaulted to shippable so older payloads are unaffected.
   */
  pickupOnly?: boolean;
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
  /**
   * Live state→zone map + green list (GOL-2292), fetched in the SSR product load.
   * Resolved ahead of the baked snapshot so the estimator prices *which zone* a
   * state is in — and gates eligibility — off the live backend, not a stale build.
   * `null` when the feed is unreachable → the estimator keeps its snapshot.
   */
  shippingZoneMap?: ShippingZoneMap | null;
  /**
   * Growing facts for the right-column "At a glance" card, the zone check and
   * the "plant two" hint (GOL-2734). The full `SpecBlock` table below the grid
   * reads the SAME facts — this component renders the decision subset, it is not
   * a second source. Absent on list-only products / older API payloads, in which
   * case the whole at-a-glance stack collapses.
   */
  facts?: GrowingFacts;
  /**
   * Declared botanical name (Odoo `grove_botanical_name`, surfaced as
   * `facts.botanical_name`) — the taxon the per-product plant-health carve-out
   * gate is keyed on (GOL-2132). Threaded through so the estimator and the
   * Format cards can tell "green state" from "green state this item is cleared
   * into" (GOL-2973). Null/"" on a consult-built mix with no declared botanical.
   */
  botanicalName?: string | null;
  /**
   * Odoo `grove_compliance_exempt` (GOL-2587). `true` → checkout skips the
   * carve-out gate for this product, so the storefront must show no carve-out
   * notice either. (GOL-2588 deliberately did not thread this: back then the
   * storefront's only per-state notice was the green-list gate, which the
   * exemption does not widen. GOL-2973 adds a notice the exemption DOES
   * suppress, so it has to reach the client now.)
   */
  complianceExempt?: boolean;
  /**
   * `ships_all_green_states` (GOL-2988): this product is a phantom/Kit-BoM
   * substitution bundle, so checkout substitutes restricted components per
   * destination and skips the carve-out gate. Threaded for the same reason as
   * `complianceExempt` — it suppresses the GOL-2973 notice (GOL-3015).
   */
  shipsAllGreenStates?: boolean;
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
  preorderCapReached,
  pickupOnly,
  shippingRates,
  shippingFeed,
  shippingZoneMap,
  facts,
  botanicalName,
  complianceExempt,
  shipsAllGreenStates,
}: ProductViewProps) {
  // Is a resolved variant farm-pickup-only? The product-level override
  // (`pickupOnly`, GOL-2587 P1) wins over the tier, so a Bareroot variant on a
  // pickup-only template still reads as pickup (GOL-2588). Declared first
  // because the mount-time default pickers call through `buyStateOf` into it.
  const productPickupOnly = (v: ViewVariant | undefined): boolean =>
    isPickupOnly(
      tierFor({ shippingTier: v?.shippingTier ?? null, format: v?.format ?? null }),
      shippingFeed,
      pickupOnly,
    );

  // Availability authority, reused by the buy box, the opening-default pickers,
  // and the cart guard so all three agree on what "purchasable" means (GOL-1862):
  // a 0-stock Bareroot is reservable (`ctaDisabled === false`), a 0-stock
  // pickup-only Potted is a dead end. Deriving the opening selection from this —
  // rather than a blind axis `[0]` — is what keeps the PDP from opening on an
  // unbuyable format when per-environment variant order sorts a dead SKU first.
  const buyStateOf = (v: ViewVariant | undefined) =>
    buyStateFor({
      available: v ? v.available : true,
      qtyAvailable: v?.qtyAvailable ?? null,
      shippingTier: v?.shippingTier ?? null,
      format: v?.format ?? null,
      saleOk,
      capReached: preorderCapReached,
      pickupOnly: productPickupOnly(v),
    });
  const isPurchasable = (v: ViewVariant | undefined) => buyStateOf(v).ctaDisabled === false;
  // Opening-default preference: real stock beats a $10-deposit reservation.
  // Without this tier, the GOL-2233 rule (sold-out bareroot stays reservable)
  // makes every cultivar "purchasable", so pages defaulted to a 0-stock
  // cultivar that merely sorted first while a sibling had trees on hand.
  const isInStock = (v: ViewVariant | undefined) => buyStateOf(v).mode === "in-stock";

  const cultivars = useMemo(() => cultivarOptions(variants), [variants]);
  const [cultivar, setCultivar] = useState<string | null>(() =>
    defaultCultivar(variants, cultivars, isPurchasable, isInStock),
  );
  // Farm pickup vs Shipped comes BEFORE Format (Josh 2026-10-07). In the potted
  // season the potted variant is the immediate buy ("Potted" picked up, "Peat &
  // bagged" shipped); the bareroot variant is the Fall/Spring pre-order card,
  // offered from Sep 1 and all of the off season. Opens on "ship" when this
  // product can ship today, else "pickup"; the mount effect below restores the
  // remembered intent when that method is offered.
  const calendar = shippingFeed?.calendar ?? null;
  const pottedSeason = isPottedSeason(new Date(), calendar);
  const preorderSeason = isPreorderSeason(new Date());
  // A feed that prices no potted box cannot ship a potted tree (GOL-2199).
  const pottedShips = !isPickupOnly("potted", shippingFeed);
  const tierOfFormat = (c: string | null, f: string): ShippingTier =>
    tierFor({
      shippingTier: pickVariant(variants, { cultivar: c, format: f })?.shippingTier ?? null,
      format: f,
    });
  const formatsFor = (m: FulfillmentMethod, c: string | null): string[] =>
    formatsForMethod(formatOptions(variants, c), m, (f) => tierOfFormat(c, f), {
      pottedSeason,
      preorderSeason,
      pottedShips,
    });
  // Can this product be bought by `m` for cultivar `c` today? A pickup-only
  // template (GOL-2587) never ships. Tier presence comes from the VARIANTS, not
  // the Format axis: prod lists formatless single-variant products (#91 PawPaw
  // bareroot, #130 White Oak potted) that must pass the same season / pre-order
  // gate as a paired listing. Without this, an empty Shipped view fell through
  // `pickVariant` to the potted variant and carted it as shippable.
  const formatlessTierOf = (c: string | null): ShippingTier | null =>
    formatOptions(variants, c).length === 0 && variants.length > 0
      ? tierFor({
          shippingTier: pickVariant(variants, { cultivar: c })?.shippingTier ?? null,
          format: null,
        })
      : null;
  const methodOffered = (m: FulfillmentMethod, c: string | null): boolean => {
    if (m === "ship" && pickupOnly) return false;
    const lone = formatlessTierOf(c);
    if (lone) {
      return (
        formatsForMethod(["formatless"], m, () => lone, {
          pottedSeason,
          preorderSeason,
          pottedShips,
        }).length > 0
      );
    }
    return formatOptions(variants, c).length === 0 || formatsFor(m, c).length > 0;
  };
  const openingMethod = (c: string | null): FulfillmentMethod =>
    methodOffered("ship", c) ? "ship" : "pickup";
  const [method, setMethod] = useState<FulfillmentMethod>(() => openingMethod(cultivar));
  const formats = useMemo(
    () => formatsFor(method, cultivar),
    [variants, cultivar, method, pottedSeason, preorderSeason, pottedShips],
  );
  const [format, setFormat] = useState<string | null>(() =>
    defaultFormat(
      variants,
      formatsFor(openingMethod(cultivar), cultivar),
      cultivar,
      isPurchasable,
      isInStock,
    ),
  );
  const rootstocks = useMemo(() => rootstockOptions(variants, cultivar), [variants, cultivar]);
  const [rootstock, setRootstock] = useState<string | null>(() =>
    defaultRootstock(variants, rootstocks, cultivar, format, isPurchasable, isInStock),
  );
  // Thumbnail the buyer explicitly clicked; null → follow the selected variant.
  const [pinnedImage, setPinnedImage] = useState<string | null>(null);
  // Destination state for the shipping estimator ("" = not chosen yet).
  const [shipState, setShipState] = useState<string>("");
  // Chosen quantity, lifted so the inline stepper and the mobile sticky bar add
  // the SAME count — tapping the bar no longer silently adds just 1 (GOL-1055).
  const [quantity, setQuantity] = useState(1);
  // Shipped pre-orders resolve their waves for the shopper's USDA zone (null
  // until chosen; remembered in `grove:usda-zone`). Pickup uses the farm zone.
  const [usdaZone, setUsdaZone] = useState<number | null>(null);
  const [chosenWave, setChosenWave] = useState<ShipWave | null>(null);

  // Restore the shopper's remembered ship-vs-pickup intent (GOL-2089) as the
  // METHOD, and their USDA zone. Client-only and mount-once, so SSR hydrates on
  // the neutral defaults; an explicit click always wins afterwards.
  useEffect(() => {
    const pref = readFulfillmentPref();
    if (pref && pref !== method && methodOffered(pref, cultivar)) {
      chooseMethod(pref, { persist: false });
    }
    const zone = readUsdaZone();
    if (zone != null && waveZones(calendar).includes(zone)) setUsdaZone(zone);
  }, []);

  const zoneOptions = useMemo(() => waveZones(calendar), [calendar]);
  // A pickup-only template never ships, so its pre-order resolves for the farm.
  // Farm pickup runs on the fixed farm schedule (fall pickup Oct 20 to Oct 31,
  // order by Oct 15; spring on the farm zone), Josh 2026-10-07.
  const isPickupWave = method === "pickup" || Boolean(pickupOnly);
  const waveZone = isPickupWave ? farmZoneOf(shippingFeed) : usdaZone;
  const waves = useMemo(
    () =>
      isPickupWave
        ? pickupWaves(new Date(), calendar, waveZone ?? undefined)
        : waveZone != null
          ? preorderWaves(waveZone, new Date(), calendar)
          : [],
    [isPickupWave, waveZone, calendar],
  );
  // The chosen wave while it is open for this zone, else the first open one.
  const wave: ShipWave | null = waves.some((w) => w.wave === chosenWave && w.open)
    ? chosenWave
    : firstOpenWave(waves);
  const axisFormats = formatOptions(variants, cultivar);
  const formatlessTier = formatlessTierOf(cultivar);
  const productTiers: ShippingTier[] = formatlessTier
    ? [formatlessTier]
    : axisFormats.map((f) => tierOfFormat(cultivar, f));
  const hasBareroot = productTiers.includes("bareroot");
  const hasPotted = productTiers.includes("potted");
  /** Does `m` offer anything to buy today (formatless products included)? */
  const offeredFor = (m: FulfillmentMethod): boolean => methodOffered(m, cultivar);
  const formatlessOffered = formatlessTier != null && offeredFor(method);

  function chooseZone(next: number) {
    setUsdaZone(next);
    writeUsdaZone(next);
  }

  // Live backend rate table when available, else the bundled snapshot (GOL-969).
  // resolveRateTable() is drift-safe: null/empty fetch → snapshot, so the
  // estimate degrades gracefully and both the Format cards and the estimator
  // panel below price against the same table.
  const rateTable = useMemo(() => resolveRateTable(shippingRates), [shippingRates]);

  // Live state→zone map + green list, feed-first with the baked snapshot as
  // fallback (GOL-2292). resolveZoneMap() is drift-safe the same way rateTable is:
  // null/empty feed → snapshot. This is what makes the estimate resolve *which
  // zone* a state is in — and gate eligibility — off the live backend, so a
  // backend re-zoning (e.g. TN → zone_7) reprices the PDP without a rebuild.
  const zoneMap = useMemo(() => resolveZoneMap(shippingZoneMap), [shippingZoneMap]);

  // Per-item plant-health carve-out verdict for the chosen state (GOL-2132 /
  // GOL-2973), resolved ONCE here and shared with the estimator panel so the
  // Format cards and the panel can never disagree about whether this item
  // clears the destination. Feed-first (the same `compliance` block checkout
  // refuses on), snapshot fallback. "clear" is the only state that may quote a
  // rate; the other two are green destinations this item can't travel to.
  const complianceMap = useMemo(() => resolveCompliance(shippingFeed), [shippingFeed]);
  const complianceSubstitutes = useMemo(() => resolveSubstitutes(shippingFeed), [shippingFeed]);
  const complianceVerdict = useMemo(
    () =>
      evaluateCompliance({
        botanicalName,
        complianceExempt,
        shipsAllGreenStates,
        state: shipState,
        compliance: complianceMap,
        substitutes: complianceSubstitutes,
      }),
    [
      botanicalName,
      complianceExempt,
      shipsAllGreenStates,
      shipState,
      complianceMap,
      complianceSubstitutes,
    ],
  );
  const shipStateCleared = complianceVerdict.kind === "clear";

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

  // Stateless "from $X" floor for the Format cards before a shopper picks a state
  // (GOL-1822). Under Box Engine v2 shipping is priced PER PACKED BOX, so the
  // legacy per-tree `ShippingHint.fromShipping` (e.g. bareroot $12) both reads as
  // a per-tree charge the engine won't honour and under-quotes the real per-box
  // floor. `estimateTierFloor` is the cheapest single-unit box rate over every
  // zone — a genuine per-box number that can never dip below the state-specific
  // estimate. Null on the legacy backend (no box feed), where the per-tier hint
  // still matches how that backend charges, so the cards fall back to it.
  //
  // Keyed BY TIER because potted re-joined the shippable set (GOL-2199, wired up
  // in GOL-2757 / #813) and its cartons are dearer than the bareroot ones: one
  // shared floor would quote the bareroot number on a potted card and under-
  // quote the shopper.
  const floorFor = useMemo(() => {
    const cache = new Map<ShippingTier, number | null>();
    return (tier: ShippingTier): number | null => {
      if (!cache.has(tier)) cache.set(tier, estimateTierFloor(tier, shippingFeed));
      return cache.get(tier) ?? null;
    };
  }, [shippingFeed]);

  // Distinct shipping tiers this product offers, for the state estimator.
  const estimatorTiers = useMemo<EstimatorTier[]>(() => {
    const seen = new Set<ShippingTier>();
    const out: EstimatorTier[] = [];
    for (const f of formats) {
      const v = pickVariant(variants, { cultivar, format: f });
      const tier = tierFor({ shippingTier: v?.shippingTier ?? null, format: f });
      if (seen.has(tier)) continue;
      seen.add(tier);
      const tierPickupOnly = isPickupOnly(tier, shippingFeed, pickupOnly);
      const hint = shippingHintFor({ shippingTier: v?.shippingTier ?? null, format: f });
      // Single presentation authority for tier timing + badge (GOL-1313), shared
      // with the Format cards below so the two can never drift.
      const { label, fulfillment, badge } = tierFulfillment({
        tier,
        label: TIER_LABEL[tier],
        pickupOnly: tierPickupOnly,
        pickupFulfillment: PICKUP_ONLY_FULFILLMENT,
        hintFulfillment: hint.fulfillment,
        shipMode,
      });
      out.push({ tier, label, fulfillment, pickupOnly: tierPickupOnly, badge });
    }
    return out;
  }, [formats, variants, cultivar, shippingFeed, shipMode, pickupOnly]);

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
    // A cultivar that can't go by the current method moves to one it can.
    const nextMethod = methodOffered(method, next) ? method : openingMethod(next);
    setMethod(nextMethod);
    // Keep the current format if the new cultivar offers it, else re-pick its
    // first *purchasable* format so the switch never lands on a dead default
    // (GOL-1862) — same order-independent rule as the initial mount.
    const nextFormats = formatsFor(nextMethod, next);
    const nextFormat =
      format && nextFormats.includes(format)
        ? format
        : defaultFormat(variants, nextFormats, next, isPurchasable, isInStock);
    setFormat(nextFormat);
    // Same reconciliation for the rootstock axis: a cultivar sold seedling-only
    // shouldn't keep a "M.111" selection from the previous one (GOL-1112), and
    // the re-pick resolves against the format we just settled on so the opening
    // triple is one real, purchasable variant.
    const nextRootstocks = rootstockOptions(variants, next);
    const nextRootstock =
      rootstock && nextRootstocks.includes(rootstock)
        ? rootstock
        : defaultRootstock(variants, nextRootstocks, next, nextFormat, isPurchasable, isInStock);
    setRootstock(nextRootstock);
    setPinnedImage(null);
  }

  function chooseFormat(next: string) {
    setFormat(next);
    setPinnedImage(null);
  }

  // Switch Farm pickup / Shipped, keeping the current format when the new method
  // still offers it, else re-picking its first purchasable one (GOL-1862). The
  // method is the remembered intent the next PDP opens on (GOL-2089).
  function chooseMethod(next: FulfillmentMethod, opts: { persist?: boolean } = {}) {
    setMethod(next);
    const nextFormats = formatsFor(next, cultivar);
    setFormat(
      format && nextFormats.includes(format)
        ? format
        : defaultFormat(variants, nextFormats, cultivar, isPurchasable, isInStock),
    );
    setPinnedImage(null);
    if (opts.persist !== false) writeFulfillmentPref(next);
  }

  function chooseRootstock(next: string) {
    setRootstock(next);
    setPinnedImage(null);
  }

  // Selected-format pickup-only flag: potted under Box Engine v2, or ANY format
  // on a pickup-only template (GOL-2587 P1 / GOL-2588). Either way the tree is
  // collected at the farm, never shipped, so we surface that before the buyer
  // hits checkout: no "ships now" promise the checkout would then block
  // (GOL-1114). Resolved before `buy` because the CTA copy keys on it.
  const selectedTier = tierFor({
    shippingTier: selected?.shippingTier ?? null,
    format,
  });
  const selectedPickupOnly = isPickupOnly(selectedTier, shippingFeed, pickupOnly);
  // A potted tree must never ship as potted: chosen for Farm pickup, or any time
  // outside the potted season, flag the cart line pickupOnly so the GOL-2588
  // checkout lock forces pickup. Independent of the method so a stale or
  // wildcarded selection can't slip a shippable potted line into the cart.
  const cartPickupOnly =
    selectedPickupOnly ||
    (selectedTier === "potted" && (method === "pickup" || !pottedSeason));

  // One buy-state decision drives the stock line, the CTA, and the sticky bar,
  // so the inline box and the mobile bar can never contradict each other
  // (GOL-678). A sold-out Bareroot is reservable, not dead.
  const buy = buyStateFor({
    available: selected ? selected.available : true,
    qtyAvailable: selected?.qtyAvailable ?? null,
    shippingTier: selected?.shippingTier ?? null,
    format,
    saleOk,
    capReached: preorderCapReached,
    pickupOnly: selectedPickupOnly,
  });

  // Bind the cart to an EXACT variant match, never to pickVariant's display
  // fallback (GOL-1862). `pickVariant` deliberately degrades to a best-effort
  // variant so price/image/hint always render, but its terminal `?? variants[0]`
  // can resolve to a SKU that doesn't match the shopper's selection — adding that
  // to the cart would buy the wrong tree. No exact match → fall back to the
  // template id (the no-variant path), which the cart / back end resolves.
  const cartMatch = variantMatches(selected, { cultivar, format, rootstock }) ? selected : null;
  const cartName = cartMatch?.name ?? name;
  const cartVariantId = cartMatch?.id ?? productId;

  // Pre-order vs immediate CTA. A bareroot line is a pre-order for ONE open
  // wave and carries it to the cart (F2 `canAdd` refuses mixing); with no open
  // wave the CTA is unavailable. Nothing offered for this method (a bareroot-only
  // listing before Sep 1, a potted-only listing outside May 1 to Oct 15, with or
  // without a Format axis) also locks the CTA.
  const nothingOffered = !offeredFor(method);
  const isPreorder = !nothingOffered && selectedTier === "bareroot";
  const ctaDisabled = buy.ctaDisabled || nothingOffered || (isPreorder && wave == null);
  const ctaLabel =
    isPreorder && !buy.ctaDisabled
      ? "Pre-order for $10"
      : buy.ctaLabel === "Add to Cart"
        ? "Add to cart"
        : buy.ctaLabel;
  const cartWave = isPreorder ? (wave ?? undefined) : undefined;
  // Before Sep 1 nothing bareroot is offered; say when it will be if the shopper
  // has nothing to buy today.
  const showPreordersOpen =
    hasBareroot &&
    !preorderSeason &&
    pottedSeason &&
    (nothingOffered || !isPurchasable(selected));

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

          <div className="mb-5">
            <span
              id="pdp-method-label"
              className="block text-sm font-semibold text-foreground mb-2"
            >
              How do you want it?
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="pdp-method-label"
            >
              {METHOD_OPTIONS.map(([m, label, sub]) => {
                const unavailable = !offeredFor(m);
                const isActive = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => chooseMethod(m)}
                    aria-pressed={isActive}
                    disabled={unavailable}
                    className={`flex flex-1 flex-col justify-start rounded border px-4 py-2 text-left text-sm transition ${
                      optionCardClass(isActive)
                    } ${unavailable ? "opacity-60" : ""}`}
                  >
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <RadioDot active={isActive} />
                      {label}
                    </span>
                    <span className="block pl-[1.375rem] text-xs text-ink-soft">
                      {unavailable ? "Not available right now" : sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {method === "ship" && hasBareroot && !pickupOnly && (
            <div className="mb-5">
              <label htmlFor="usda-zone" className="block text-sm font-semibold text-foreground mb-2">
                Your USDA zone
              </label>
              <select
                id="usda-zone"
                value={usdaZone ?? ""}
                onChange={(e) => {
                  if (e.target.value) chooseZone(Number(e.target.value));
                }}
                className="w-full rounded border border-primary/20 bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Choose your zone</option>
                {zoneOptions.map((z) => (
                  <option key={z} value={z}>
                    Zone {z}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(formats.length > 0 || formatlessOffered) && (
            <div className="mb-5">
              <span className="block text-sm font-semibold text-foreground mb-2">Format</span>
              <div className="flex flex-wrap gap-2">
                {/* A formatless listing's single variant, shown as the same card a
                    paired listing would show for its tier. */}
                {formatlessOffered && formatlessTier === "bareroot" && (
                  <PreorderCard
                    method={method}
                    price={selected?.price ?? null}
                    selected
                    onSelect={() => {}}
                    zone={waveZone}
                    waves={waves}
                    wave={wave}
                    onChooseWave={setChosenWave}
                  />
                )}
                {formatlessOffered && formatlessTier === "potted" && (
                  <div className={`rounded border px-4 py-2 text-left text-sm ${optionCardClass(true)}`}>
                    <span className="block font-medium text-foreground">
                      {pickupOnly ? "Potted" : methodFormatLabel(method, "potted", "Potted")}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      ${price.toFixed(2)} · charged in full
                    </span>
                  </div>
                )}
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
                  const fPickupOnly = isPickupOnly(fTier, shippingFeed, pickupOnly);
                  // Bareroot is always a Fall/Spring wave pre-order (Josh 2026-10-07).
                  if (fTier === "bareroot") {
                    return (
                      <PreorderCard
                        key={f}
                        method={method}
                        price={fVariant?.price ?? null}
                        selected={f === format}
                        onSelect={() => chooseFormat(f)}
                        zone={waveZone}
                        waves={waves}
                        wave={wave}
                        onChooseWave={(w) => {
                          setChosenWave(w);
                          if (f !== format) chooseFormat(f);
                        }}
                      />
                    );
                  }
                  // A carve-out blocks the ITEM, not the format, so it kills the
                  // quote for every format (GOL-2973) — the card must not echo a
                  // "ship $20 to FL" the estimator panel just said we can't do.
                  const fEst =
                    shipState && !fPickupOnly && shipStateCleared
                      ? estimateTierShipping(shipState, fTier, {
                          feed: shippingFeed,
                          rates: rateTable,
                          zoneMap,
                        })
                      : null;
                  // Pickup-only formats never quote a ship rate; every other
                  // branch is the existing shippable copy. Before a state is
                  // picked, prefer the Box Engine v2 per-box floor over the
                  // legacy per-tree hint so the card can't advertise a per-tree
                  // "$12" the engine won't honour (GOL-1822); `floorFor` is null
                  // on the legacy backend, where the per-tier hint still holds.
                  const fFromFloor = floorFor(fTier) ?? fHint.fromShipping;
                  const shipText = fPickupOnly
                    ? "farm pickup only"
                    : fEst != null
                      ? `ship $${fEst.toFixed(0)} to ${shipState}`
                      : shipState && !shipsTo(shipState, zoneMap)
                        ? `not shipping to ${shipState} yet`
                        : shipState && !shipStateCleared
                          ? // Green state, item not cleared into it. Different
                            // words from the not-green line above so the two
                            // reasons stay distinguishable at a glance.
                            `not cleared for ${shipState}, see below`
                          : `ships from ~$${fFromFloor}`;
                  // Same tier-presentation authority as the estimator rows above
                  // (GOL-1313): bareroot follows today's mode; potted takes its
                  // static hint, or the pickup line while the feed prices no
                  // potted box (GOL-2199 / #813).
                  const {
                    label: fLabel,
                    fulfillment: fFulfillment,
                    badge: fBadge,
                  } = tierFulfillment({
                    tier: fTier,
                    label: f,
                    // Under Farm pickup every card is collected at the farm, so
                    // no card may carry a ship promise ("Ships now", GOL-1114).
                    pickupOnly: fPickupOnly || method === "pickup",
                    pickupFulfillment: fPickupOnly
                      ? PICKUP_ONLY_FULFILLMENT
                      : PICKUP_METHOD_FULFILLMENT,
                    hintFulfillment: fHint.fulfillment,
                    shipMode,
                  });
                  const isActive = f === format;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => chooseFormat(f)}
                      aria-pressed={isActive}
                      className={`rounded border px-4 py-2 text-left text-sm transition ${
                        optionCardClass(isActive)
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <RadioDot active={isActive} />
                        {methodFormatLabel(method, fTier, fLabel)}
                        {fBadge && (
                          <span className="rounded-full border border-primary/25 bg-secondary/15 px-1.5 py-px text-[0.65rem] font-medium text-foreground">
                            {fBadge}
                          </span>
                        )}
                      </span>
                      <span className="block pl-[1.375rem] text-xs text-ink-soft">
                        {[
                          fVariant ? `$${fVariant.price.toFixed(2)}` : null,
                          fFulfillment,
                          // Pickup-only formats don't quote a ship line — the
                          // fulfillment already says "Farm pickup only".
                          fPickupOnly || method === "pickup" ? null : shipText,
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
                        optionCardClass(isActive)
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

          {/* Shipping estimator. Hidden outright on a pickup-only product
              (GOL-2588): there is no rate to estimate, no state that changes the
              answer, and a state select would be a dead control that implies we
              might ship. The "Farm pickup only" note below carries the whole
              fulfillment story instead (progressive disclosure: don't ask for
              input that cannot change the outcome). Potted-only products keep
              the panel, because their bareroot siblings still price per state. */}
          {estimatorTiers.length > 0 && !pickupOnly && method === "ship" && (
            <ShippingEstimator
              state={shipState}
              onStateChange={setShipState}
              tiers={estimatorTiers}
              rates={rateTable}
              feed={shippingFeed}
              zoneMap={zoneMap}
              botanicalName={botanicalName}
              complianceExempt={complianceExempt}
              shipsAllGreenStates={shipsAllGreenStates}
            />
          )}

          <p className="text-sm mb-2">
            {/* Badge lives on an inner span: .stock-line is inline-flex (it
                renders the status glyph via ::before), so it must not take
                over the paragraph's block layout. */}
            <span className={STOCK_TONE_CLASS[buy.stockTone]}>{buy.stockLabel}</span>
          </p>

          {/* Weather-hold advisory (GOL-1177 `weather_hold_note`, surfaced
              GOL-1313): an admin-set frost-delay banner ops can toggle without a
              deploy. Meaning never rides colour alone — an alert glyph plus the
              bold "Shipping hold" label carry it (colour-blind safe). Only shown
              for shipped tiers; potted is pickup-only and unaffected. */}
          {shipMode?.weatherHoldNote && !selectedPickupOnly && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-md border border-primary/25 bg-secondary/15 px-3 py-2 text-xs text-foreground"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="mt-0.5 h-4 w-4 shrink-0 fill-primary"
              >
                <path d="M12 2 1 21h22L12 2Zm0 5 7.5 13h-15L12 7Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
              </svg>
              <span>
                <strong className="font-semibold">Shipping hold.</strong>{" "}
                {shipMode.weatherHoldNote}
              </span>
            </p>
          )}

          {selectedPickupOnly && (
            // Icon + words (never colour alone): this format is farm pickup only.
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
                {/* A pickup-only PRODUCT has no shippable sibling format to offer, so
                    its copy must not send the buyer looking for one (GOL-2588). The
                    potted wording keeps the bareroot escape hatch, which is true
                    there. Both name the free pickup, never colour-coded. */}
                {pickupOnly
                  ? "This one is collected at the farm, not shipped. Reserve it here and pick it up free during our open hours."
                  : "Potted trees aren’t shipped. Pick yours up free at the farm, or choose a bareroot format to ship to your door."}
              </span>
            </p>
          )}

          {hasPotted && !hasBareroot && !pottedSeason && (
            <p className="mb-4 text-xs text-ink-soft">Potted trees are sold May 1 to Oct 15.</p>
          )}

          {showPreordersOpen && (
            <p className="mb-4 text-xs text-ink-soft">
              Bareroot is sold as a pre-order. Pre-orders open Sep 1.
            </p>
          )}

          <div data-add-to-cart-anchor className="mt-4">
            <AddToCartButton
              variantId={cartVariantId}
              templateId={productId}
              name={cartName}
              price={price}
              imageUrl={hero}
              disabled={ctaDisabled}
              idleLabel={ctaLabel}
              quantity={quantity}
              onQuantityChange={setQuantity}
              pickupOnly={cartPickupOnly}
              wave={cartWave}
            />
          </div>

          {(buy.mode === "sold-out" || buy.mode === "coming-soon") && (
            // One-CTA-per-page (GOL-2178): this restock capture is the page's
            // highest-priority tier, so registering it here suppresses the
            // shared footer newsletter for the whole PDP. `restock` always wins
            // over `newsletter`, so this block itself always renders.
            <CaptureSlot priority="restock">
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
                  description="We'll send one email when it's ready to ship. That's it."
                  submitLabel="Notify me"
                  successMessage="You're on the list. We'll email you when it's ready."
                  consentText="We'll only email you about this. Unsubscribe anytime."
                />
              </div>
            </CaptureSlot>
          )}

          <p className="mt-4 text-xs text-ink-soft">
            Free local pickup Tue–Sat, 10am–7pm. Can’t make those hours? Call us after ordering.
          </p>
          {/* A pickup-only product must not advertise a whole-footprint ship
              promise it cannot keep (GOL-2588); the policy link stays, since the
              warranty terms still apply to a picked-up tree. The footprint
              wording is derived — D.C. is in the green list and is not a state
              (GOL-2941). */}
          <p className="mt-1 text-xs text-ink-soft">
            {pickupOnly
              ? "Farm pickup only, not shipped. "
              : `Ships to ${shipScope().phrase}, priced live at checkout. `}
            <PolicyLink /> for full shipping and warranty terms.
          </p>

          {/* ── "At a glance" stack (GOL-2734) ─────────────────────────────
              The three decision aids sit at the FOOT OF THE BUY COLUMN: on
              desktop that fills the dead space the taller gallery used to leave
              beside it, and on phones (grid collapses to one column) the same
              DOM stacks straight after Add-to-cart in decision order. ONE render
              each — there is no md:-hidden mobile duplicate anywhere on this
              page. ZoneCheck moved up from below the description; the full
              `SpecBlock` table still renders lower down with every row. */}
          <ZoneCheck zoneMin={facts?.zoneMin ?? null} zoneMax={facts?.zoneMax ?? null} />

          <AtAGlance facts={facts} />

          {/* The hint's only action is "Set quantity to 2", so it renders only
              while the CTA can actually add: never beside a sold-out, coming-soon,
              out-of-season or no-open-wave buy box (same `ctaDisabled` that
              locks AddToCartButton and the sticky bar). */}
          {!ctaDisabled && (
            <PlantTwoHint
              pollination={facts?.pollination}
              quantity={quantity}
              onPlantTwo={() => setQuantity(PLANT_TWO_QUANTITY)}
            />
          )}
        </div>
      </div>

      <StickyAddToCartBar
        variantId={cartVariantId}
        templateId={productId}
        name={cartName}
        price={price}
        imageUrl={hero}
        disabled={ctaDisabled}
        idleLabel={ctaLabel}
        quantity={quantity}
        pickupOnly={cartPickupOnly}
        wave={cartWave}
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

/** Fulfillment method buttons, in display order (Josh 2026-10-07). */
const METHOD_OPTIONS: ReadonlyArray<readonly [FulfillmentMethod, string, string]> = [
  ["pickup", "Farm pickup", "Free · Tue to Sat"],
  ["ship", "Shipped", "To 31 states and Washington, D.C."],
];

/** Format-card fulfillment line when the shopper chose Farm pickup. */
const PICKUP_METHOD_FULFILLMENT = "Pick up at the farm";

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
