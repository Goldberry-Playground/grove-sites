"use client";

import type { PreorderWave, ShipWave } from "@grove/odoo-client";
import type { FulfillmentMethod } from "../../../lib/fulfillment-method";
import { formatMonthDay } from "../../../lib/fulfillment-mode";
import {
  waveClosedLabel,
  waveOrderByLabel,
  waveWindowLabel,
} from "../../../lib/preorder-waves";

export interface PreorderCardProps {
  method: FulfillmentMethod;
  /** Variant price, shown before the deposit line. */
  price: number | null;
  /** The bareroot format is the selected Format. */
  selected: boolean;
  onSelect: () => void;
  /** Zone the waves resolve for (destination zone shipped, farm zone pickup). */
  zone: number | null;
  /** Fall then spring, empty while a shipped shopper has not picked a zone. */
  waves: PreorderWave[];
  /** The effective (open) wave, or null when none is open. */
  wave: ShipWave | null;
  onChooseWave: (wave: ShipWave) => void;
}

const WAVE_NAME: Record<FulfillmentMethod, Record<ShipWave, string>> = {
  ship: { fall: "Fall wave", spring: "Spring wave" },
  pickup: { fall: "Fall pickup", spring: "Spring pickup" },
};

/**
 * The Bareroot pre-order Format card (Josh 2026-10-07, mockup v4): a $10
 * deposit reserves a tree in ONE Fall or Spring wave. Closed waves stay visible
 * but greyed with the reason, so the shopper sees when the next one opens.
 */
export function PreorderCard({
  method,
  price,
  selected,
  onSelect,
  zone,
  waves,
  wave,
  onChooseWave,
}: PreorderCardProps) {
  const anyOpen = waves.some((w) => w.open);
  const chosen = waves.find((w) => w.wave === wave && w.open) ?? null;
  const needsZone = method === "ship" && zone == null;
  const greyed = !needsZone && !anyOpen;
  const subline = [
    price != null ? `$${price.toFixed(2)}` : null,
    "$10 deposit today",
    method === "pickup" ? "pick up, we will call you to schedule" : "balance when it ships",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-preorder-card
      className={`w-full rounded border px-4 py-3 text-sm transition ${
        selected ? "border-primary bg-primary/5" : "border-primary/15"
      } ${greyed ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full text-left"
      >
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          Bareroot pre-order
          <span className="rounded-full border border-primary/25 bg-secondary/15 px-1.5 py-px text-[0.65rem] font-medium text-foreground">
            Pre-order
          </span>
        </span>
        <span className="block text-xs text-ink-soft">{subline}</span>
      </button>

      {needsZone ? (
        <p className="mt-2 text-xs text-ink-soft">
          Choose your USDA zone above to see your ship dates.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Pre-order wave">
          {waves.map((w) => {
            const isActive = chosen?.wave === w.wave;
            return (
              <button
                key={w.wave}
                type="button"
                aria-pressed={isActive}
                aria-disabled={!w.open}
                onClick={() => {
                  if (w.open) onChooseWave(w.wave);
                }}
                className={`rounded border px-3 py-2 text-left text-xs transition ${
                  !w.open
                    ? "cursor-not-allowed border-dashed border-primary/20 opacity-60"
                    : isActive
                      ? "border-primary bg-primary/5"
                      : "border-primary/15 hover:border-primary/40"
                }`}
              >
                <span className="block font-medium text-foreground">
                  {WAVE_NAME[method][w.wave]}
                </span>
                <span className="block text-ink-soft">{waveWindowLabel(w)}</span>
                <span className="block text-ink-soft">
                  {w.open ? waveOrderByLabel(w) : waveClosedLabel(w)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {chosen && (
        <p className="mt-2 text-xs text-ink-soft">
          Pre-order with a flat $10 deposit.{" "}
          {method === "pickup"
            ? `${WAVE_NAME.pickup[chosen.wave]} approx`
            : `Zone ${zone} ${chosen.wave} wave ships approx`}{" "}
          {formatMonthDay(chosen.ship_window[0])} to {formatMonthDay(chosen.ship_window[1])}.
          Dates are approximate and weather permitting.
        </p>
      )}
      {greyed && (
        <p className="mt-2 text-xs text-ink-soft">
          No pre-order wave is open right now. Pre-orders open Sep 1.
        </p>
      )}
      <p className="mt-2 text-xs font-medium text-foreground">
        Pre-orders check out on their own, one wave per order.
      </p>
    </div>
  );
}
