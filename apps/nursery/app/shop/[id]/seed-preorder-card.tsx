"use client";

import type { SeedSeason } from "@grove/odoo-client";
import { formatIsoMonthDay, seedShipWindow, SEED_DEPOSIT } from "@grove/checkout";
import { RadioDot, optionCardClass } from "./option-card";

/** One Pack size choice on a seed product. */
export interface SeedPack {
  variantId: number;
  /** Pack size axis value ("Pack of 10", "1 lb"). */
  label: string;
  price: number;
}

/**
 * CTA copy for a seed pre-order (Josh, seed pre-orders spec 2026-10-09):
 * "Reserve for $1" in season, "Pre-order for fall YYYY, $1" once this season
 * has rolled over to next fall's harvest.
 */
export function seedCtaLabel(season: SeedSeason): string {
  return season.rolledOver ? `Pre-order for fall ${season.year}, $${SEED_DEPOSIT}` : `Reserve for $${SEED_DEPOSIT}`;
}

/** The rolled-over banner: why this season closed and which harvest it is now. */
export function seedRolloverMessage(season: SeedSeason): string {
  const lead =
    season.reason === "cap_reached"
      ? "This season’s harvest is fully reserved."
      : "This season’s pre-orders have closed.";
  return `${lead} You’re reserving from the fall ${season.year} harvest, shipping approx ${seedShipWindow(season)}.`;
}

/**
 * Seed pre-order block for the PDP (GOL-3258): harvest badge, ship window,
 * rollover banner, Pack size radio cards and the $1 deposit note. Uses the same
 * radio-card treatment as the Format picker (`option-card.tsx`, GOL-3246) so a
 * selected pack reads the same way a selected Format does.
 *
 * Colour never carries the season state on its own (WCAG 1.4.1): the badge pairs
 * green/amber with a different glyph (leaf vs clock), and a rolled-over season
 * also gets the banner sentence spelling it out.
 */
export function SeedPreorderCard({
  season,
  packs,
  selectedId,
  onSelect,
}: {
  season: SeedSeason;
  packs: SeedPack[];
  selectedId: number | null;
  onSelect: (variantId: number) => void;
}) {
  const closed = !season.open;
  return (
    <div data-seed-preorder-card className="mb-5">
      {closed ? (
        <p className="mb-4 text-sm text-ink-soft">Not taking reservations right now.</p>
      ) : (
        <>
          <p className="mb-2">
            <HarvestBadge season={season} />
          </p>
          <p className="mb-4 text-sm text-foreground">
            Ships approx {seedShipWindow(season)} · order by {formatIsoMonthDay(season.orderBy)}
          </p>
          {season.rolledOver && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-md border border-caution/40 bg-secondary/15 px-3 py-2 text-xs text-foreground"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="mt-0.5 h-4 w-4 shrink-0 fill-caution"
              >
                <path d="M12 2 1 21h22L12 2Zm0 5 7.5 13h-15L12 7Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
              </svg>
              <span>{seedRolloverMessage(season)}</span>
            </p>
          )}
        </>
      )}

      <span id="pdp-pack-label" className="block text-sm font-semibold text-foreground mb-2">
        Pack size
      </span>
      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="pdp-pack-label">
        {packs.map((p) => {
          const isActive = p.variantId === selectedId;
          return (
            <button
              key={p.variantId}
              type="button"
              onClick={() => onSelect(p.variantId)}
              aria-pressed={isActive}
              className={`rounded border px-4 py-2 text-left text-sm transition ${optionCardClass(isActive)}`}
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <RadioDot active={isActive} />
                {p.label}
              </span>
              <span className="block pl-[1.375rem] text-xs text-ink-soft">${p.price.toFixed(2)}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Pay a ${SEED_DEPOSIT} deposit today. The rest of the pack price, plus shipping and tax, is
        charged when your order ships.{" "}
        <strong className="font-medium text-foreground">Seed pre-orders check out on their own.</strong>
      </p>
    </div>
  );
}

/** "Fall 2026 harvest": moss + leaf in season, amber + clock once rolled over. */
function HarvestBadge({ season }: { season: SeedSeason }) {
  const rolled = season.rolledOver;
  return (
    <span
      data-harvest-badge={rolled ? "rolled-over" : "in-season"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        rolled ? "border-caution/40 text-caution" : "border-affirm/40 text-affirm"
      }`}
    >
      {rolled ? (
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.5 1.5" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13c0-6 4-9.5 10-10-.5 6-4 10-10 10Z" />
          <path d="M3 13 9 7" />
        </svg>
      )}
      Fall {season.year} harvest
    </span>
  );
}
