"use client";

import { useEffect } from "react";
import type { ShippingTier } from "@grove/odoo-client";
import { CaptureForm } from "@grove/ui-kit";
import {
  US_STATE_NAMES,
  ZONE_BY_STATE,
  ZONE_RATE_TABLE,
  estimateShipping,
  shipsTo,
  type RateTable,
} from "../../../lib/shipping-estimate";

const STORAGE_KEY = "grove:ship-state";

/** A tier this product actually offers, with the timing line to show beside it. */
export interface EstimatorTier {
  tier: ShippingTier;
  /** Display label, e.g. "Potted" / "Bareroot". */
  label: string;
  /** Fulfillment timing line, e.g. "Ships now" / "Reserve for October". */
  fulfillment: string;
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
}

/**
 * "Estimate shipping to your state" (GOL-943). A native state selector that,
 * on selection, shows the per-tree estimate for each format this product ships
 * — or, for a state we don't reach yet, a plain-spoken "not there yet" with a
 * pickup + notify-me path (never a dead end, never a guessed charge).
 *
 * State is lifted to the parent so the Format cards can echo the same number,
 * and remembered in localStorage so a returning shopper doesn't re-enter it.
 *
 * Accessibility: the select is labelled; the result region is aria-live; every
 * eligibility state pairs an icon *and* words (colour is never the only signal —
 * colour-blind / grayscale safe). Primary copy clears WCAG AA on the parchment
 * surface; the muted "· timing" / "/ tree" / disclaimer suffixes use the house
 * `text-foreground/55`–`/60` convention (~3–4:1), tracked for the app-wide
 * muted-token sweep — they're supporting text, never the sole carrier of meaning.
 */
export function ShippingEstimator({
  state,
  onStateChange,
  tiers,
  rates = ZONE_RATE_TABLE,
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

  const eligible = shipsTo(state);
  const stateName = state ? US_STATE_NAMES[state] : "";

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
            We ship living trees to {GREEN_STATE_COUNT} states — pick yours to see the
            per-tree rate. Each tree ships in its own box; your exact rate is confirmed
            at checkout.
          </p>
        )}

        {state !== "" && eligible && (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <span aria-hidden="true" className="text-secondary">✓</span>
              We ship to {stateName}
            </p>
            <ul className="mt-2 space-y-1.5">
              {tiers.map(({ tier, label, fulfillment }) => {
                const amount = estimateShipping(state, tier, rates);
                return (
                  <li
                    key={tier}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">
                      {label}
                      <span className="text-foreground/55"> · {fulfillment}</span>
                    </span>
                    <span className="font-semibold text-foreground whitespace-nowrap">
                      {amount != null ? `$${amount.toFixed(0)}` : "—"}
                      <span className="font-normal text-foreground/55"> / tree</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-foreground/55">
              Estimated UPS Ground, priced per tree. Your exact rate is confirmed at
              checkout.
            </p>
          </div>
        )}

        {state !== "" && !eligible && (
          <div className="rounded border border-accent/30 bg-accent/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <span aria-hidden="true" className="text-accent">ⓘ</span>
              We can’t ship living trees to {stateName} yet
            </p>
            <p className="mt-1.5 text-xs text-foreground/70">
              We’re expanding our nursery certifications state by state. You can still
              pick your trees up free at the farm — or leave your email below and we’ll
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
                description="One email when we open your state — nothing else."
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

/** Exposed for parent copy: the count of states we currently ship to. */
export const GREEN_STATE_COUNT = Object.keys(ZONE_BY_STATE).length;
