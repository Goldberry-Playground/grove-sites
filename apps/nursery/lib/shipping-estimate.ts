import type {
  ShippingTier,
  ShippingRateFeed,
  ShippingZoneMap,
  ShippingBoxId,
  PackingMode,
} from "@grove/odoo-client";

/**
 * Client-side "estimate shipping to your state" calculator (GOL-943).
 *
 * The product page's static "ships from ~$X" hints (see `shipping-hints.ts`)
 * answer "roughly how much?"; this answers the shopper's real question — "what
 * will it cost to *my* state?" — the moment they pick a state, before checkout.
 *
 * ── Source of truth ─────────────────────────────────────────────────────────
 * This mirrors the backend zone engine that actually prices the order at
 * checkout: grove-odoo-modules `grove_headless/models/shipping_zones.py` +
 * `data/shipping_rates.json`. Design: vault wiki `Software/Grove Shipping`.
 *
 * Two kinds of data live here, and they drift at very different rates:
 *
 *   • ZONE_BY_STATE / GREEN_STATES — the 32-state green list and its zone map.
 *     This is the compliance gate; it changes only when the nursery unlocks a
 *     new state (a deliberate backend PR), so mirroring it in the client is
 *     safe and keeps the estimate honest about *where* we ship.
 *
 *   • ZONE_RATE_TABLE — the dollar values. These are PROVISIONAL and are
 *     rewritten daily by the backend rate-checker. This snapshot is fine for a
 *     clearly-labelled *estimate*, but it can drift from the live table. The
 *     drift-safe seam is `resolveRateTable()`: pass a table fetched from the
 *     backend and it overrides the snapshot. Wiring that fetch is the backend
 *     follow-up (see GOL-943 child issue) — until then we show the snapshot and
 *     the UI says "estimated" and "your exact rate is confirmed at checkout".
 *
 * Never treat this estimate as the charge: the order is always priced by the
 * backend engine at checkout. This module never *under*-quotes (unknown tier →
 * potted, the heavier/dearer tier) and never invents a rate for an ineligible
 * state (returns `null`, mirroring the backend's fail-safe `None`).
 */

/** Per-zone, per-tier launch snapshot of `data/shipping_rates.json` (2026-07-02,
 *  provisional). Keep the structure identical to the backend file so a fetched
 *  table can drop in unchanged. `base` is the per-tree charge in whole dollars. */
export interface ZoneTierRate {
  base: number;
}
export type RateTable = Record<string, Partial<Record<ShippingTier, ZoneTierRate>>>;

export const ZONE_RATE_TABLE: RateTable = {
  zone_1: { bareroot: { base: 21 }, potted: { base: 32 } },
  zone_2: { bareroot: { base: 22 }, potted: { base: 34 } },
  zone_3: { bareroot: { base: 23 }, potted: { base: 36 } },
  zone_4: { bareroot: { base: 24 }, potted: { base: 38 } },
  zone_5: { bareroot: { base: 25 }, potted: { base: 40 } },
  // zone_6 / zone_7 were retired by GOL-2238 P1 (2026-09-14): the 2026-09-08
  // probe's mid/near-plains split was a mis-bin — a live re-probe folded TN back
  // to zone_1 and AR/MO/IA back to zone_5 (their real bands), so the backend
  // `data/shipping_rates.json` is 5 zones again. Keep this in lock-step.
};

/** state code → zone id, mirroring backend `ZONE_BY_STATE` (the 32 green states). */
export const ZONE_BY_STATE: Record<string, string> = {
  // zone_1 — nearest (UPS ~2–4 from origin 26651). DC joins here (GOL-2128).
  // TN belongs here (GOL-2238 P1, 2026-09-14): a live re-probe put TN's worst
  // corner (Memphis 38103) at the zone_1 published rate exactly, and it borders
  // KY/VA/NC (all zone_1). The 2026-09-08 zone_7 mis-bin had it above Iowa.
  WV: "zone_1", VA: "zone_1", KY: "zone_1", NC: "zone_1", DE: "zone_1", DC: "zone_1",
  TN: "zone_1",
  // zone_2
  MD: "zone_2", PA: "zone_2", OH: "zone_2", IN: "zone_2", NJ: "zone_2", NY: "zone_2",
  // zone_3
  IL: "zone_3", MI: "zone_3", CT: "zone_3", RI: "zone_3",
  // zone_4
  WI: "zone_4", MN: "zone_4", MA: "zone_4", VT: "zone_4", NH: "zone_4",
  // zone_5 — farthest priced band. GA/SC/AL/MS/LA (+ ME) and the mid-continent
  // AR/MO/IA all bin here: GOL-2238 P1 (2026-09-14) re-probed the 2026-09-08
  // split and folded AR/MO/IA back to their real zone_5 rate (worst corners
  // 23/28 small/large, 26/41 potted — the zone_5 published rate exactly), so
  // the interim zone_6 that overcharged them is retired. Every zone still
  // dominates its members' worst-corner targets, so no state is ever
  // undercharged. Mirrors backend ZONE_BY_STATE.
  GA: "zone_5", AL: "zone_5", SC: "zone_5", MS: "zone_5", LA: "zone_5", ME: "zone_5",
  AR: "zone_5", MO: "zone_5", IA: "zone_5",
  // Florida (GOL-2235): green as of the GOL-2132 compliance carve-out gate
  // (Castanea/Cornus blocked into FL). Its worst corners (Miami 33101, Key West
  // 33040) quote at or under the zone_5 published rate on the Pirate Ship source
  // (2026-09-14 targets 20/24 small/large, 23/30 potted), so FL bins at zone_5 —
  // no new band, never undercharged. Mirrors backend ZONE_BY_STATE["FL"].
  FL: "zone_5",
  // Ratified far states (OK/KS/NE/SD/ND/TX/NM/AZ) are still NOT green: they
  // clear on cost but await the per-product NPB compliance carve-out gate
  // (GOL-2132) — see the GOL-2243 far-states follow-up.
};

/** Count of states we currently ship living trees to — the single source for
 *  every *static* "ships to N states" copy (marketing pages, footers) so it can
 *  never drift from the baked green list. Derives from `ZONE_BY_STATE`. Interactive
 *  surfaces that receive a live feed should prefer `resolveZoneMap(...).greenStates`
 *  so the count reflects the live backend, not this snapshot (GOL-2292). */
export const GREEN_STATE_COUNT = Object.keys(ZONE_BY_STATE).length;

/**
 * Resolved state→zone map + green list the estimator prices *which zone* against.
 * Feed-driven when a live feed is present, else the baked snapshot — the same
 * drift-safe seam as `resolveRateTable()`, but for the compliance zone map rather
 * than the dollar values (GOL-2292). `zoneByState` is camelCase (idiomatic TS);
 * the wire shape (`ShippingZoneMap.zone_by_state`) stays snake_case.
 */
export interface ZoneMap {
  zoneByState: Record<string, string>;
  greenStates: string[];
}

/** The bundled snapshot as a `ZoneMap` — the fallback when no live feed reaches
 *  the estimator. Kept in sync with the backend by the drift test (GOL-2292). */
export const SNAPSHOT_ZONE_MAP: ZoneMap = {
  zoneByState: ZONE_BY_STATE,
  greenStates: Object.keys(ZONE_BY_STATE),
};

/**
 * Prefer the live feed's `zone_by_state` / `green_states` over the baked snapshot,
 * degrading to the snapshot when the feed is unreachable or carries no map — the
 * mirror of `resolveRateTable()` for the compliance zone map (GOL-2292).
 *
 * This is the fix for the PDP-vs-checkout drift where a backend re-zoning (e.g.
 * TN → zone_1, GOL-2238 P1) repriced checkout but the storefront kept quoting the
 * stale baked zone until a frontend release. Accepts either the schema-agnostic
 * {@link ShippingZoneMap} (from `shipping.zoneMap()`) or the full schema-2
 * {@link ShippingRateFeed}, since both carry the wire fields.
 */
export function resolveZoneMap(
  feed?:
    | Pick<ShippingZoneMap, "zone_by_state" | "green_states">
    | { zone_by_state?: Record<string, string> | null; green_states?: string[] | null }
    | null,
): ZoneMap {
  const zoneByState = feed?.zone_by_state;
  if (zoneByState && Object.keys(zoneByState).length > 0) {
    const greenStates =
      feed?.green_states && feed.green_states.length > 0
        ? feed.green_states
        : Object.keys(zoneByState);
    return { zoneByState, greenStates };
  }
  return SNAPSHOT_ZONE_MAP;
}

/** Every US state + DC, for the selector. Non-green entries drive the
 *  "not shipping there yet" path, so demand for expansion is measurable. */
export const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const DEFAULT_TIER: ShippingTier = "potted"; // never undercharge an untagged product

function normalizeState(state: string | null | undefined): string {
  return (state ?? "").trim().toUpperCase();
}

/** True when we currently ship living trees to `state` (in the green list).
 *  Pass a resolved `zoneMap` (from `resolveZoneMap(feed)`) to gate on the LIVE
 *  green list; omit it to use the baked snapshot (GOL-2292). */
export function shipsTo(
  state: string | null | undefined,
  zoneMap: ZoneMap = SNAPSHOT_ZONE_MAP,
): boolean {
  return normalizeState(state) in zoneMap.zoneByState;
}

/** Resolve the shipping tier for a variant, mirroring `shippingHintFor`'s
 *  fallback: prefer the server tier, else sniff the Format axis, else potted. */
export function tierFor(input: {
  shippingTier?: ShippingTier | null;
  format?: string | null;
}): ShippingTier {
  if (input.shippingTier === "bareroot" || input.shippingTier === "potted") {
    return input.shippingTier;
  }
  if (input.format && /bare\s*-?\s*root/i.test(input.format)) return "bareroot";
  return DEFAULT_TIER;
}

/**
 * Estimated per-tree shipping to `state` for one tier, in whole dollars, or
 * `null` when we don't ship there (state outside the green list, or no rate
 * configured for the zone/tier). `null` means "no estimate — never a $0 or a
 * guessed charge", exactly like the backend engine's fail-safe.
 *
 * Pass `rates` to price against a live table fetched from the backend; omit it
 * to use the bundled provisional snapshot. Pass `zoneByState` (from
 * `resolveZoneMap(feed).zoneByState`) to resolve the state's zone from the LIVE
 * green list; omit it to use the baked snapshot (GOL-2292).
 */
export function estimateShipping(
  state: string | null | undefined,
  tier: ShippingTier,
  rates: RateTable = ZONE_RATE_TABLE,
  zoneByState: Record<string, string> = ZONE_BY_STATE,
): number | null {
  const zone = zoneByState[normalizeState(state)];
  if (!zone) return null;
  const tierKey = tier === "bareroot" || tier === "potted" ? tier : DEFAULT_TIER;
  const rule = rates[zone]?.[tierKey];
  if (!rule || typeof rule.base !== "number") return null;
  return rule.base;
}

/** Allow a backend-fetched rate table to override the bundled snapshot. Keeps
 *  the estimator drift-safe once GOL-943's backend endpoint lands. */
export function resolveRateTable(fetched?: RateTable | null): RateTable {
  return fetched && Object.keys(fetched).length > 0 ? fetched : ZONE_RATE_TABLE;
}

// ── Box Engine v2 (schema-2) estimator leg — GOL-1114 ────────────────────────
// Box Engine v2 (grove-odoo-modules #60) reprices bareroot shipping PER PACKED
// BOX, not per tree, and drops potted from shipping entirely (potted is farm
// pickup only — see `shipping_zones.py` SHIPPABLE_TIERS = {"bareroot"}). When
// the backend serves the schema-2 `rateFeed()`, the legacy tier-keyed
// `rates()` returns null, so the product page prices bareroot off the box feed
// below and no longer has (or needs) a potted ship rate.

/** Tree length class (min box length in inches its height requires) for the
 *  product-card estimate. Mirrors backend `shipping_boxes.DEFAULT_LENGTH` — the
 *  20-in class fits the current 1–2 yr inventory. A taller product can pass its
 *  own class; a longer box is always usable, never a shorter one. */
export const DEFAULT_LENGTH_CLASS = 20;

/** Packing mode for the product-card estimate. Under the two-SKU catalog both
 *  boxes carry the same count in either mode, so the mode no longer changes
 *  which box a single tree picks; leafed stays the default to mirror backend
 *  `single_tree_rate(..., mode="leafed")` and keep the estimate stable across
 *  seasons. Real season is resolved server-side at checkout; here we only need a
 *  "from $X" floor. */
const DEFAULT_MODE: PackingMode = "leafed";

/**
 * Cheapest bareroot shipping for ONE tree to `state` under Box Engine v2, in
 * whole dollars, or `null` when unshippable (state outside the green list, no
 * box long enough, or no rate configured). Faithful client mirror of
 * grove_headless `single_tree_rate()`: for a single tree the min-cost pack is
 * simply the cheapest *rated* box that is (a) at least as long as the tree's
 * length class and (b) used in the given packing mode. Multi-tree consolidation
 * (the DP packer) is priced by the backend at checkout — this is the product
 * card's honest floor, exactly like the tier-keyed `estimateShipping` it
 * supersedes.
 *
 * Potted is never priced here: potted has no shippable box by design (it is
 * farm pickup only). Callers render potted as a pickup-only card instead.
 */
export function estimateBoxShipping(
  state: string | null | undefined,
  feed: ShippingRateFeed,
  opts: { lengthClass?: number; mode?: PackingMode } = {},
): number | null {
  const zone = feed.zone_by_state[normalizeState(state)];
  if (!zone) return null;
  const rates = feed.zones[zone];
  if (!rates) return null;
  const lengthClass = opts.lengthClass ?? DEFAULT_LENGTH_CLASS;
  const mode = opts.mode ?? DEFAULT_MODE;

  let cheapest: number | null = null;
  for (const [boxId, spec] of Object.entries(feed.packing.boxes)) {
    if (!spec) continue;
    if (spec.length < lengthClass) continue; // box too short for this tree
    if (spec.capacity[mode] == null) continue; // box unused in this mode
    const rate = rates[boxId as ShippingBoxId]?.base;
    if (typeof rate !== "number") continue; // no rate configured for this box
    if (cheapest == null || rate < cheapest) cheapest = rate;
  }
  return cheapest == null ? null : Math.round(cheapest);
}

/**
 * The stateless "from $X" bareroot floor under Box Engine v2 — the cheapest
 * single-tree box rate over *every* shippable zone, in whole dollars, or `null`
 * when no rate is configured. This is the honest number to show BEFORE a shopper
 * picks a state: it is a real per-box rate (the cheapest zone × cheapest usable
 * box), so it can never be lower than the state-specific `estimateBoxShipping`
 * the estimator resolves once a state is chosen. It exists so the Format cards
 * stop advertising the legacy per-tree `ShippingHint.fromShipping`, which the
 * box engine no longer honours and which under-quotes the real floor (GOL-1822).
 *
 * Same box-eligibility rules as `estimateBoxShipping` (length class + packing
 * mode); only the zone loop is widened to the global minimum.
 */
export function estimateBoxFloor(
  feed: ShippingRateFeed,
  opts: { lengthClass?: number; mode?: PackingMode } = {},
): number | null {
  const lengthClass = opts.lengthClass ?? DEFAULT_LENGTH_CLASS;
  const mode = opts.mode ?? DEFAULT_MODE;

  let cheapest: number | null = null;
  for (const rates of Object.values(feed.zones)) {
    if (!rates) continue;
    for (const [boxId, spec] of Object.entries(feed.packing.boxes)) {
      if (!spec) continue;
      if (spec.length < lengthClass) continue; // box too short for this tree
      if (spec.capacity[mode] == null) continue; // box unused in this mode
      const rate = rates[boxId as ShippingBoxId]?.base;
      if (typeof rate !== "number") continue; // no rate configured for this box
      if (cheapest == null || rate < cheapest) cheapest = rate;
    }
  }
  return cheapest == null ? null : Math.round(cheapest);
}

/**
 * Per-tier shipping estimate for the product page, in whole dollars or `null`.
 * The single seam both the Format cards and the estimator panel price through,
 * so they can never disagree. Bareroot prices off the schema-2 box feed when
 * one is present (Box Engine v2), else off the legacy tier-keyed snapshot;
 * potted always uses the tier-keyed path — until the potted=farm-pickup-only
 * flip is ratified (GOL-1114 gate), potted keeps its existing behaviour and is
 * never routed through the box feed (which has no potted rate by design).
 *
 * The box-feed path resolves the state's zone from `feed.zone_by_state`, which is
 * intrinsically live; the tier-keyed path resolves it from `opts.zoneMap` (from
 * `resolveZoneMap(feed)`), falling back to the baked snapshot — so BOTH paths
 * price against the live green list, never a stale baked zone (GOL-2292).
 */
export function estimateTierShipping(
  state: string | null | undefined,
  tier: ShippingTier,
  opts: { feed?: ShippingRateFeed | null; rates?: RateTable; zoneMap?: ZoneMap } = {},
): number | null {
  if (tier === "bareroot" && hasBoxFeed(opts.feed)) {
    return estimateBoxShipping(state, opts.feed);
  }
  return estimateShipping(
    state,
    tier,
    opts.rates ?? ZONE_RATE_TABLE,
    (opts.zoneMap ?? SNAPSHOT_ZONE_MAP).zoneByState,
  );
}

/** True when `feed` is a usable schema-2 Box Engine v2 feed (has box-keyed
 *  zones and a packing catalog). The client's `rateFeed()` already returns null
 *  for a legacy schema-1 payload, so this is a light null/shape guard for the
 *  render path. */
export function hasBoxFeed(
  feed: ShippingRateFeed | null | undefined,
): feed is ShippingRateFeed {
  return !!feed && !!feed.packing?.boxes && Object.keys(feed.zones ?? {}).length > 0;
}

/** Customer-facing timing line for a farm-pickup-only format. Paired with the
 *  pickup glyph in the UI so meaning never rides on colour alone. */
export const PICKUP_ONLY_FULFILLMENT = "Farm pickup only";

/**
 * True when this tier renders as farm-pickup-only rather than a shippable format
 * (GOL-1114, ratified 2026-08-03). Potted has no shippable box under Box Engine
 * v2 — `shipping_zones.py` `SHIPPABLE_TIERS = {"bareroot"}` — and checkout blocks
 * a potted ship line as pickup-only. We flip the storefront to match *exactly
 * when the box feed is live* (`hasBoxFeed`): on the legacy backend (no feed)
 * potted still ships and checkout still allows it, so gating on the feed keeps
 * the product page and checkout consistent in BOTH backend generations — never
 * "ships now" on the page but blocked at checkout, and never "pickup only" on the
 * page but charged shipping at checkout. Bareroot is always shippable.
 */
export function isPickupOnly(
  tier: ShippingTier,
  feed: ShippingRateFeed | null | undefined,
): boolean {
  return tier === "potted" && hasBoxFeed(feed);
}
