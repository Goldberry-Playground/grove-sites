"use client";

import { useState } from "react";
import { trackEvent } from "@grove/analytics";

import type { TipId, TipOption } from "../../lib/links";

/** Sponsor-a-Tree: pick an amount, then hand off to that amount's Stripe Payment Link. */
export function LinksTipJar({ options, source }: { options: TipOption[]; source: string }) {
  const [picked, setPicked] = useState<TipId>("10");
  const selected = options.find((o) => o.id === picked) ?? options[0];
  const cta = selected.id === "custom" ? "Choose your amount" : `Sponsor with ${selected.label}`;

  return (
    <section className="hub-links__tip" aria-labelledby="hub-links-tip-title">
      <span className="hub-links__eyebrow">Sponsor a tree</span>
      <h2 id="hub-links-tip-title">Help put another tree in the ground</h2>
      <p>Every tip goes to educational material and to planting and restoring Appalachian forests.</p>
      <div className="hub-links__amounts" role="group" aria-label="Tip amount">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === selected.id}
            onClick={() => setPicked(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <a
        className="hub-links__tip-cta"
        href={selected.href}
        rel="noopener"
        onClick={() => trackEvent("links_click", { target: `tip_${selected.id}`, source })}
      >
        {cta}
      </a>
      <span className="hub-links__fine">Secure checkout by Stripe</span>
    </section>
  );
}
