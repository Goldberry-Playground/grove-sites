"use client";

import { useEffect, useMemo } from "react";
import type { ShippingTier, ShippingRateFeed } from "@grove/odoo-client";
import { CaptureForm } from "@grove/ui-kit";
import {
  GREEN_STATE_COUNT,
  US_STATE_NAMES,
  ZONE_RATE_TABLE,
  SNAPSHOT_ZONE_MAP,
  estimateTierShipping,
  shipsTo,
  type RateTable,
  type ZoneMap,
} from "../../../lib/shipping-estimate";
import {
  consultMixOutlook,
  evaluateCompliance,
  resolveCompliance,
  resolveSubstitutes,
} from "../../../lib/plant-compliance";
import { ConsultCarveOutNotice } from "../../consult-carveout-notice";

const STORAGE_KEY = "grove:ship-state";

/** A tier this product actually offers, with the timing line to show beside it. */
export interface EstimatorTier {
  tier: ShippingTier;
  /** Display label, e.g. "Potted" / "Bareroot". */
  label: string;
  /** Fulfillment timing line, e.g. "Ships now" / "Reserve for October". */
  fulfillment: string;
  /** True when this format is farm-pickup-only (no ship price) under Box Engine
   *  v2 — see `isPickupOnly` (GOL-1114). Renders a pickup row, never a rate. */
  pickupOnly?: boolean;
  /** Short mode badge for a shippable format ("Preorder" / "Peat & bagged"), or
   *  null when it just ships in season (GOL-1114). Words + a bordered chip, never
   *  colour alone. */
  badge?: string | null;
}

export interface ShippingEstimatorProps {
  /** Currently selected state code ("" = none picked yet). Controlled by the parent. */
  state: string;
  onStateChange: (state: string) => void;
  /** Distinct shipping tiers this product offers (deduped, in display order). */
  tiers: EstimatorTier[];
  /** Rate table to price against — the live backend feed resolved by the parent
   *  (GOL-969), or the bundled snapshot when the feed is absent. Defaults to the
   *  snapshot so the component still works standalone (e.g. in tests). */
  rates?: RateTable;
  /** Schema-2 Box Engine v2 feed (GOL-1114). When present, bareroot rows price
   *  per packed box off this feed; potted stays on the tier-keyed `rates`. */
  feed?: ShippingRateFeed | null;
  /** Resolved live state→zone map + green list (GOL-2292), from the parent's
   *  `resolveZoneMap(feed)`. Drives eligibility (`shipsTo`), the tier-keyed zone
   *  lookup, and the "ships to N states" count off the LIVE backend rather than
   *  the baked snapshot. Defaults to the snapshot so the component works
   *  standalone (e.g. in tests). */
  zoneMap?: ZoneMap;
  /**
   * Declared botanical name for this product (Odoo `grove_botanical_name`) —
   * the taxon the plant-health carve-out gate is keyed on (GOL-2973). Null/""
   * on a consult-built mix that deliberately declares none (templates 134/135),
   * which is exactly what makes it `unconfirmed` into a regulated state rather
   * than silently clear. Optional so older callers and tests are unaffected;
   * absent behaves like an undeclared botanical.
   */
  botanicalName?: string | null;
  /**
   * Odoo `grove_compliance_exempt` (GOL-2587). `true` means checkout SKIPS the
   * per-line carve-out gate for this product, so the notice must stay silent —
   * warning about an order that sails through is its own kind of lie.
   */
  complianceExempt?: boolean;
  /**
   * `ships_all_green_states` (GOL-2988): this is a phantom/Kit-BoM substitution
   * bundle, so checkout swaps out whatever the destination restricts and skips
   * the carve-out gate. Suppresses the notice for the same reason
   * `complianceExempt` does, and matters more: a bundle declares the CEILING of
   * its palette (GOL-2972), so its botanical reads as restricted here while the
   * order ships fine (GOL-3015).
   */
  shipsAllGreenStates?: boolean;
  /**
   * Odoo `grove_consult_built` (API `consult_built`, GOL-3019). `true` on a mix
   * whose plant list is agreed in a consult after the deposit (templates
   * 134/135). Checkout no longer refuses the deposit for a regulated
   * destination, so the panel owes the shopper the honest constraint for that
   * state BEFORE they pay rather than a flat "we can't confirm this"
   * (GOL-3028). Optional: absent keeps the pre-GOL-3019 cautious branch.
   */
  consultBuilt?: boolean;
}

/**
 * "Estimate shipping to your state" (GOL-943). A native state selector that,
 * on selection, resolves the destination into exactly one of FOUR states:
 *
 *   1. green + this item is cleared — the per-box "from" estimate per format;
 *   2. green but this item is NOT cleared — the per-taxon plant-health
 *      carve-out (GOL-2132) that checkout refuses the order on, so the panel
 *      names the reason and shows NO rate (GOL-2973). Item-specific, not
 *      geographic: "we ship to Florida, but not this chestnut";
 *   3. green + a consult-built mix into a regulated state — checkout DOES take
 *      the deposit now (GOL-3019), so the panel discloses which species this
 *      state takes off the list and how many of the fourteen still clear, before
 *      the shopper pays (GOL-3028). A narrowing, not a refusal;
 *   4. not green — a plain-spoken "not there yet".
 *
 * Every branch carries a next action (pickup, a swap, a consult, notify-me), so
 * none of them is a dead end, and none of them guesses a charge we won't honour.
 *
 * Box Engine v2 (GOL-1114/GOL-1208): shippable formats are priced PER PACKED
 * BOX and consolidate into as few boxes as possible, so the amount shown is a
 * "from $X" floor for one box — never a linear per-tree charge the engine won't
 * honour. Copy mirrors vault `Software/Grove Shipping` "How your trees ship".
 *
 * State is lifted to the parent so the Format cards can echo the same number,
 * and remembered in localStorage so a returning shopper doesn't re-enter it.
 *
 * Accessibility: the select is labelled; the result region is aria-live; every
 * eligibility state pairs an icon *and* words (colour is never the only signal —
 * colour-blind / grayscale safe). Primary copy clears WCAG AA on the parchment
 * surface; the muted "· timing" / "from" / disclaimer suffixes use the house
 * `text-foreground/55`–`/60` convention (~3–4:1), tracked for the app-wide
 * muted-token sweep — they're supporting text, never the sole carrier of meaning.
 */
export function ShippingEstimator({
  state,
  onStateChange,
  tiers,
  rates = ZONE_RATE_TABLE,
  feed,
  zoneMap = SNAPSHOT_ZONE_MAP,
  botanicalName,
  complianceExempt,
  shipsAllGreenStates,
  consultBuilt,
}: ShippingEstimatorProps) {
  // Restore a previously entered state on mount (client-only; SSR renders "none").
  useEffect(() => {
    if (state) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in US_STATE_NAMES) onStateChange(saved);
    } catch {
      /* localStorage unavailable (private mode) — no-op */
    }
    // Mount-only: restore the saved state once; parent owns it thereafter.
  }, []);

  function choose(next: string) {
    onStateChange(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const eligible = shipsTo(state, zoneMap);
  const stateName = state ? US_STATE_NAMES[state] : "";
  // Second gate (GOL-2132 / GOL-2973). The green list says whether we reach the
  // state at all; this says whether THIS item is cleared into it. Feed-first off
  // the same `compliance` / `bundle_substitution` blocks checkout refuses with,
  // snapshot as the fallback — so the PDP can never promise what checkout will
  // reject. Pure + synchronous: no network call, so the panel still answers
  // inside the Doherty threshold on `change`.
  const compliance = useMemo(() => resolveCompliance(feed), [feed]);
  const substitutes = useMemo(() => resolveSubstitutes(feed), [feed]);
  const verdict = useMemo(
    () =>
      evaluateCompliance({
        botanicalName,
        complianceExempt,
        shipsAllGreenStates,
        consultBuilt,
        state,
        compliance,
        substitutes,
      }),
    [
      botanicalName,
      complianceExempt,
      shipsAllGreenStates,
      consultBuilt,
      state,
      compliance,
      substitutes,
    ],
  );
  // Palette outlook for the consult-constrained branch: how much of our
  // food-forest palette this destination restricts, and therefore how many
  // species clear. Derived from the same feed map as the verdict, so the count
  // and the gate agree.
  const outlook = useMemo(
    () =>
      verdict.kind === "consult-constrained"
        ? consultMixOutlook(state, compliance)
        : null,
    [verdict, state, compliance],
  );
  const cleared = verdict.kind === "clear";
  // Live green-state count when the feed reached us, else the baked snapshot
  // count (GOL-2292) — the interactive panel reflects the live backend, unlike
  // the static marketing pages that keep the module-level GREEN_STATE_COUNT.
  const greenCount = zoneMap.greenStates.length || GREEN_STATE_COUNT;

  return (
    <section
      aria-labelledby="ship-est-label"
      className="mb-5 rounded-lg border border-primary/15 bg-white/60 p-4"
    >
      <label
        id="ship-est-label"
        htmlFor="ship-est-state"
        className="block text-sm font-semibold text-foreground mb-2"
      >
        Estimate shipping to your state
      </label>
      <select
        id="ship-est-state"
        value={state}
        onChange={(e) => choose(e.target.value)}
        className="w-full rounded border border-primary/20 bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Select your state…</option>
        {Object.entries(US_STATE_NAMES).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>

      {/* aria-live so screen readers announce the estimate when the state changes. */}
      <div aria-live="polite" className="mt-3">
        {state === "" && (
          <p className="text-xs text-foreground/60">
            We ship living trees to {greenCount} states. Pick yours to see your
            rate. Your trees ship together in as few boxes as possible, priced per box;
            your exact rate is confirmed at checkout.
          </p>
        )}

        {state !== "" && eligible && cleared && (
          <div>
            <p className="flex items-start gap-1.5 text-sm font-medium text-primary">
              {/* Inline SVG, not U+2713: the three faces we load (Fraunces /
                  Newsreader / IBM Plex Mono) cover no Dingbats, so the
                  character fell through to whatever symbol font the device
                  happened to have and painted as tofu on one that had none
                  (GOL-3112). It also drops `text-secondary`, which measured
                  2.41:1 against the panel: the same fill-value-used-as-a-
                  foreground mistake `border-accent/70` made in GOL-3028.
                  currentColor inherits the label ink instead, at 10.88:1. */}
              <svg
                aria-hidden="true"
                className="mt-1 h-3 w-3 shrink-0"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1.75 6.4 4.6 9.25 10.25 2.9" />
              </svg>
              We ship to {stateName}
            </p>
            <ul className="mt-2 space-y-1.5">
              {tiers.map(({ tier, label, fulfillment, pickupOnly, badge }) => {
                const amount = pickupOnly
                  ? null
                  : estimateTierShipping(state, tier, { feed, rates, zoneMap });
                return (
                  <li
                    key={tier}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">
                      {label}
                      {badge && (
                        <span className="ml-1.5 rounded-full border border-primary/25 bg-secondary/15 px-1.5 py-px text-[0.65rem] font-medium align-middle text-foreground">
                          {badge}
                        </span>
                      )}
                      <span className="text-foreground/55"> · {fulfillment}</span>
                    </span>
                    {pickupOnly ? (
                      // Potted has no shippable box (Box Engine v2) — it's picked
                      // up free at the farm, so there is no per-state rate to show.
                      // "Free" + the "Farm pickup only" line above carry the meaning
                      // in words, never colour alone (a11y / colour-blind safe).
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        Free
                        <span className="font-normal text-foreground/55"> · pickup</span>
                      </span>
                    ) : (
                      // Box Engine v2 prices per packed box; trees consolidate
                      // into as few boxes as possible, so this is a "from" floor
                      // for one box, never a linear per-tree charge.
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        {amount != null ? (
                          <>
                            <span className="font-normal text-foreground/55">from </span>
                            {`$${amount.toFixed(0)}`}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-foreground/55">
              Estimated UPS Ground, priced per box. Your trees ship together in as few
              boxes as possible. Your exact rate is confirmed at checkout.
            </p>
          </div>
        )}

        {/* Third eligibility state (GOL-2973): we DO ship to this state, but
            this item is not cleared into it — the per-taxon plant-health
            carve-out the checkout gate refuses the order on. Deliberately
            distinct from the "not there yet" panel below: that one is about
            geography, this one is about the item, so the heading names the item
            rather than the state. No rate is rendered — quoting a "from $20"
            for something we will refuse at checkout is the actual harm.

            Colour-independence: three eligibility states, three icons AND three
            different opening phrases ("We ship to …" / "Not cleared for …" /
            "We can’t ship living trees to … yet"), so the panel reads correctly
            in grayscale and under deuteranopia / protanopia / tritanopia. */}
        {/* FOURTH eligibility state (GOL-3028): a consult-built mix into a
            regulated destination. Distinct from the two below because the
            answer is no longer "we can't" — GOL-3019 defers the compliance
            decision to mix time and records the excluded taxa on the order, so
            the deposit goes through and the shopper is owed the constraint in
            advance rather than a refusal. Honest and specific: the species this
            state takes off the list, by name, and how many of the fourteen we
            grow still clear. No rate: the mix is not built yet, so the box count
            that prices it genuinely is not known, and the notice says so. Add to
            Cart stays available, which is the whole point of the deferral. */}
        {state !== "" && eligible && verdict.kind === "consult-constrained" && (
          <ConsultCarveOutNotice
            state={state}
            compliance={compliance}
            surface="pdp"
            outlook={outlook ?? undefined}
          />
        )}

        {state !== "" &&
          eligible &&
          (verdict.kind === "restricted" || verdict.kind === "unconfirmed") && (
          <div className="rounded border border-accent/30 bg-accent/5 p-3">
            <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
              {/* Full-opacity accent border, not /70: measured 2.27:1 against the
                  panel tint, under the 3:1 non-text UI guideline. Decorative and
                  aria-hidden so it was never a conformance failure, but the fix
                  is a single token and keeps both notice icons one family
                  (GOL-3028). */}
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent text-[0.6rem] font-bold leading-none text-accent"
              >
                !
              </span>
              {verdict.kind === "restricted"
                ? `Not cleared for ${stateName}`
                : `We can’t confirm this one for ${stateName}`}
            </p>
            {verdict.kind === "restricted" ? (
              <p className="mt-1.5 text-xs text-foreground/70">
                We ship to {stateName}, but it restricts {verdict.taxonLabel} for
                plant-health reasons, so this one can’t travel there.
                {verdict.substitute
                  ? ` We can swap in ${verdict.substitute.label} (${verdict.substitute.botanical}), which ${stateName} does allow. Ask us below and we’ll set it up, or pick this one up free at the farm.`
                  : " You can still pick it up free at the farm, or ask us below and we’ll suggest something that clears."}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-foreground/70">
                {stateName} restricts certain plants for plant-health reasons, and we
                haven’t confirmed where this one falls. We won’t promise a delivery we
                can’t make, so ask us below and we’ll check it and come back to you.
                You can also pick it up free at the farm.
              </p>
            )}
            <div className="mt-3">
              {/* Same real capture path as the not-green branch below (POSTs to
                  /api/newsletter/subscribe). The state and the blocked taxon ride
                  along in `label`, so "which items are we turning away, and
                  where?" is a measurable signal rather than a dead end.
                  Forgiveness lens: this is a pre-emptive, recoverable notice with
                  a named next action — never an error, never a wall. */}
              <CaptureForm
                brand="nursery"
                source="notify-me"
                label={
                  verdict.kind === "restricted"
                    ? `nursery-carveout-${state}-${verdict.taxonKey}`
                    : `nursery-unconfirmed-${state}`
                }
                interests={["nursery", "compliance-swap"]}
                heading={
                  verdict.kind === "restricted"
                    ? `Ask us about shipping to ${stateName}`
                    : `Ask us about ${stateName}`
                }
                description={
                  verdict.kind === "restricted"
                    ? "Leave your email and we’ll come back with what we can ship to you."
                    : "Leave your email and we’ll check this one for your state and come back to you."
                }
                submitLabel="Ask us"
                successMessage={`Got it. We’ll email you about ${stateName}, usually within a business day.`}
                consentText="We’ll only email you about this request. Unsubscribe anytime."
              />
            </div>
          </div>
        )}

        {state !== "" && !eligible && (
          <div className="rounded border border-accent/30 bg-accent/5 p-3">
            <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
              {/* An ASCII letter in a bordered circle, not U+24D8: Enclosed
                  Alphanumerics is outside the loaded faces too, so the glyph
                  tofu'd the same way (GOL-3112). This is the construction
                  GOL-2973 introduced and GOL-3028 corrected to a full-opacity
                  accent border: 3.26:1 against the panel tint, over the 3:1
                  non-text guideline, where /70 measured 2.27:1. Decorative and
                  aria-hidden: the wording carries the state, not the icon. */}
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent text-[0.6rem] font-bold leading-none text-accent"
              >
                i
              </span>
              We can’t ship living trees to {stateName} yet
            </p>
            <p className="mt-1.5 text-xs text-foreground/70">
              We’re expanding our nursery certifications state by state. You can still
              pick your trees up free at the farm, or leave your email below and we’ll
              tell you the moment {stateName} opens up.
            </p>
            <div className="mt-3">
              {/* Real capture path (POSTs to /api/newsletter/subscribe). The chosen
                  state rides along in `label` so "which states want us?" is a
                  measurable signal, not a dead link. Mirrors the back-in-stock
                  CaptureForm pattern in product-view.tsx. */}
              <CaptureForm
                brand="nursery"
                source="notify-me"
                label={`nursery-ship-request-${state}`}
                interests={["nursery", "ship-request"]}
                heading={`Notify me when you ship to ${stateName}`}
                description="One email when we open your state. Nothing else."
                submitLabel="Notify me"
                successMessage={`You’re on the list. We’ll email you the moment ${stateName} opens up.`}
                consentText="We’ll only email you about shipping to your state. Unsubscribe anytime."
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Re-exported for parent copy from the estimate lib, the single source of the
 *  green-state count so every "ships to N states" line stays in lockstep. */
export { GREEN_STATE_COUNT };
