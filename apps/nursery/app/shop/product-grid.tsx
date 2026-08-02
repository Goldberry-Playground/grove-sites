"use client";

import { useState, type ReactNode } from "react";
import { trackEvent } from "@grove/analytics";

/**
 * Card-count cap for the /shop grid (QA 2026-07-31 — a full 28-plant catalog
 * dumped every card at once, so the page was a long uninterrupted scroll with
 * no sense of "how much is here"). We render the first `cap` cards, state the
 * total plainly ("Showing 12 of 28 plants"), and reveal the rest on demand —
 * a bounded first paint, never a SILENT truncation.
 *
 * The cards are built server-side (real next/image, live Odoo data) and handed
 * in as an element array; this boundary only decides how many are mounted, so
 * no product data crosses into client code. Below the cap the whole control is
 * absent — a short catalog reads exactly as before.
 *
 * Accessibility: the count is a polite `aria-live` region so screen-reader
 * users hear "Showing 24 of 28" when they reveal; the button carries the full
 * total in its accessible name; the cue is text (never colour-only). Revealing
 * is additive and reversible ("Show fewer" collapses back), so it's forgiving.
 */
export interface ProductGridProps {
  /** Server-rendered card elements, already ordered. */
  cards: ReactNode[];
  /** How many to show before the reveal. Defaults to a ~4-row first paint. */
  cap?: number;
}

const DEFAULT_CAP = 12;

export function ProductGrid({ cards, cap = DEFAULT_CAP }: ProductGridProps) {
  const [expanded, setExpanded] = useState(false);
  const total = cards.length;
  const overCap = total > cap;
  const capped = overCap && !expanded;
  const visible = capped ? cards.slice(0, cap) : cards;

  return (
    <>
      <div className="var-grid">{visible}</div>

      {overCap && (
        <div className="grid-reveal">
          <p className="grid-reveal__status" aria-live="polite">
            Showing {visible.length} of {total} plants
          </p>
          {capped ? (
            <button
              type="button"
              className="grid-reveal__btn"
              onClick={() => {
                trackEvent("catalog_reveal", { from: cap, total });
                setExpanded(true);
              }}
            >
              Show all {total} plants
            </button>
          ) : (
            <button
              type="button"
              className="grid-reveal__btn grid-reveal__btn--ghost"
              onClick={() => setExpanded(false)}
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </>
  );
}
