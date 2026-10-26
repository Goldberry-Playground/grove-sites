"use client";

import Link from "next/link";
import { CaptionGlyph } from "./badges";
import { STRATA, type SuggestedGroups, type SuggestedPlant } from "@grove/planner";
import * as copy from "./copy";
import { dropSpan } from "./months";
import { CautionMark, CheckMark } from "./questions";
import { productPath } from "../../lib/product-path";

export interface SuggestedListProps {
  suggestions: SuggestedGroups;
  onAdd: (pick: SuggestedPlant) => void;
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * The suggested list (planner-winter-beta spec §C.2): everything eligible
 * for the ZIP and the site that the plan did not place, grouped by stratum in
 * planting order, sorted by score, each with Add. A hand add is a learning
 * signal, so the list sits right under the plan where a person who knows
 * what they want will find it, and it never nags: an empty stratum is simply
 * not shown.
 */
export function SuggestedList({ suggestions, onAdd }: SuggestedListProps) {
  const groups = STRATA.map((s) => [s, suggestions.groups[s]] as const).filter(([, g]) => g.length > 0);
  return (
    <section aria-labelledby="plan-suggested-heading" className="mt-10" data-testid="plan-suggested">
      <h3 id="plan-suggested-heading" className="font-display text-xl text-primary-deep">
        {copy.SUGGESTED_HEADING}
      </h3>
      <p className="mt-1 max-w-prose text-sm text-ink-soft">{copy.SUGGESTED_LEDE}</p>
      {groups.length === 0 && <p className="mt-4 text-sm text-ink-soft">{copy.SUGGESTED_EMPTY}</p>}
      {groups.map(([stratum, picks]) => (
        <div key={stratum} className="mt-6" data-testid={`plan-suggested-${stratum}`}>
          <h4 className="font-mono text-[11px] tracking-[0.18em] uppercase text-primary-deep">
            {copy.STRATUM_LABELS[stratum]}
          </h4>
          <ul className="mt-2 divide-y divide-primary/10 border-y border-primary/10" aria-label={`${copy.STRATUM_LABELS[stratum]} suggestions`}>
            {picks.map((pick) => (
              <SuggestedRow key={pick.plant.id} pick={pick} onAdd={() => onAdd(pick)} />
            ))}
          </ul>
        </div>
      ))}
      {suggestions.hidden > 0 && (
        <p className="mt-4 text-xs text-ink-soft" data-testid="plan-suggested-hidden">
          {copy.SUGGESTED_HIDDEN(suggestions.hidden)}
        </p>
      )}
    </section>
  );
}

function SuggestedRow({ pick, onAdd }: { pick: SuggestedPlant; onAdd: () => void }) {
  const p = pick.plant;
  const span = dropSpan(p.harvest_months);
  return (
    <li className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 py-3" data-testid="plan-suggested-line">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={productPath(p)} className="font-semibold text-foreground underline-offset-2 hover:underline">
            {p.name}
          </Link>
          <span className="text-sm italic text-ink-soft">{p.botanical_name}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          {p.role && (
            <span className="rounded-full bg-primary/[0.08] px-2 py-0.5 font-mono tracking-[0.14em] uppercase text-primary-deep">
              {copy.ROLE_LABELS[p.role]}
            </span>
          )}
          {pick.zoneFit === "marginal" ? (
            <span className="inline-flex items-center gap-1 text-caution">
              <CautionMark />
              {copy.ZONE_FIT_MARGINAL}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-affirm">
              <CheckMark />
              {copy.ZONE_FIT_SAFE}
            </span>
          )}
          {p.succession && <CaptionGlyph text={copy.SUCCESSION_LABELS[p.succession]} />}
          {span && (
            <span>
              {copy.HARVEST_LABEL} {span}
            </span>
          )}
          {p.years_to_fruit_min != null && p.years_to_fruit_min > 0 && <span>{copy.YEARS_LABEL(p.years_to_fruit_min)}</span>}
          {p.substrate && <span>{copy.GROWS_ON(p.substrate)}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold">{usd(p.price)}</span>
        <button
          type="button"
          className="btn btn-forest-outline min-h-11 px-4 py-2 text-sm"
          onClick={onAdd}
          aria-label={`${copy.SUGGESTED_ADD} ${p.name}`}
          data-testid="plan-suggested-add"
        >
          {copy.SUGGESTED_ADD}
        </button>
      </div>
    </li>
  );
}
