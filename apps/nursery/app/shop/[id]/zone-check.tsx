"use client";

import { useRef, useState } from "react";

/**
 * "Will this grow for me?" zone-check widget (design spec §"buy box" / ZIP-zone).
 *
 * Accepts EITHER a 5-digit US ZIP or a USDA hardiness zone typed directly:
 *   - a 5-digit ZIP is resolved to its USDA zone via the `/api/zone` BFF
 *     (backed by grove_headless `zip_usda_zone.csv`), then compared;
 *   - a 1–2 digit value is treated as a zone the buyer already knows.
 * The resolved zone is compared against the plant's zone_min..zone_max from the
 * facts block. Renders nothing when the product has no zone data.
 *
 * Since GOL-2734 this renders inside the PDP's buy column (top of the "At a
 * glance" stack), not below the description. Two a11y contracts come with that
 * move: the fit/miss verdicts use the AA-safe `text-affirm` / `text-caution`
 * parchment foregrounds — NOT Tailwind `text-green-700` / `text-amber-700`,
 * which measure 3.93:1 on --paper-deep and fail AA — and each verdict leads with
 * its own inline-SVG mark plus wording that states the answer ("Yes —" /
 * "Outside its range —"), so fit never rides on colour alone (WCAG 1.4.1). The
 * input clears the 44px tap target (GOL-2440) and keeps the tokenized global
 * :focus-visible ring (no `outline-none`).
 */
export function ZoneCheck({ zoneMin, zoneMax }: { zoneMin: number | null; zoneMax: number | null }) {
  const [input, setInput] = useState("");
  const [resolvedZone, setResolvedZone] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "unknown">("idle");
  // Monotonic request id — a slow ZIP lookup that resolves after the buyer has
  // typed something else must not overwrite the newer state.
  const reqId = useRef(0);

  if (zoneMin == null && zoneMax == null) return null;

  const min = zoneMin ?? -Infinity;
  const max = zoneMax ?? Infinity;

  async function onChange(raw: string) {
    const value = raw.trim();
    setInput(value);
    setResolvedZone(null);
    setStatus("idle");
    const id = ++reqId.current;

    if (/^\d{5}$/.test(value)) {
      setStatus("loading");
      try {
        const res = await fetch(`/api/zone?zip=${value}`);
        if (id !== reqId.current) return; // superseded by newer input
        if (res.ok) {
          const data = (await res.json()) as { zone: number };
          setResolvedZone(data.zone);
          setStatus("idle");
        } else {
          setStatus("unknown");
        }
      } catch {
        if (id === reqId.current) setStatus("unknown");
      }
    } else if (/^\d{1,2}$/.test(value)) {
      setResolvedZone(Number(value));
    }
  }

  const fits = resolvedZone == null ? null : resolvedZone >= min && resolvedZone <= max;

  const range =
    zoneMin != null && zoneMax != null
      ? `zones ${zoneMin}–${zoneMax}`
      : zoneMin != null
        ? `zone ${zoneMin} and warmer`
        : `zone ${zoneMax} and cooler`;

  return (
    <div className="mt-6 rounded-lg border border-primary/10 bg-secondary/10 p-4">
      <label htmlFor="zone-check" className="block text-sm font-semibold text-foreground mb-2">
        Will this grow where you are?
      </label>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <input
          id="zone-check"
          inputMode="numeric"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your ZIP or USDA zone"
          className="min-h-11 w-40 rounded border border-primary/20 bg-white px-3 py-2 text-sm focus:border-primary"
        />
        <span className="text-xs text-ink-soft">Hardy in {range}.</span>
      </div>
      {status === "loading" && (
        <p className="mt-2 text-sm text-ink-soft">Looking up your zone…</p>
      )}
      {status === "unknown" && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-caution">
          <CautionMark />
          <span>We couldn&apos;t find that ZIP. Try entering your USDA zone directly.</span>
        </p>
      )}
      {resolvedZone != null && /^\d{5}$/.test(input) && (
        <p className="mt-2 text-xs text-ink-soft">
          ZIP {input} is in USDA zone {resolvedZone}.
        </p>
      )}
      {fits === true && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-affirm">
          <CheckMark />
          <span>Yes, this plant is hardy in your zone.</span>
        </p>
      )}
      {fits === false && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-caution">
          <CautionMark />
          <span>
            Outside its range. This plant is rated for {range}, and you are in zone{" "}
            {resolvedZone}.
          </span>
        </p>
      )}
    </div>
  );
}

/* The two verdict marks are inline SVG, NOT text glyphs. "✓" is not in the
   Newsreader body face, so it falls through to whatever the device happens to
   have — and tofus outright where nothing covers U+2713. The house pattern for
   this is already CSS/SVG shapes (see `.stock-line::before` and `.facet-caret`
   in globals.css). Both are aria-hidden and inherit `currentColor`: the verdict
   itself is carried by the words ("Yes," / "Outside its range."), so nothing
   depends on the mark or on colour (WCAG 1.4.1). */
function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current">
      <path d="M6.2 12.4 2 8.2l1.5-1.5 2.7 2.7 6.3-6.3L14 4.6l-7.8 7.8Z" />
    </svg>
  );
}

function CautionMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current">
      <path d="M8 1.3 15.3 14H.7L8 1.3Zm-.9 4.5v4h1.8v-4H7.1Zm0 5.2v1.6h1.8V11H7.1Z" />
    </svg>
  );
}
