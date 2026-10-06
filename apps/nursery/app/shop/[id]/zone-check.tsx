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
      <div className="flex items-center gap-2">
        <input
          id="zone-check"
          inputMode="numeric"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your ZIP or USDA zone"
          className="w-40 rounded border border-primary/20 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-xs text-ink-soft">Hardy in {range}.</span>
      </div>
      {status === "loading" && (
        <p className="mt-2 text-sm text-ink-soft">Looking up your zone…</p>
      )}
      {status === "unknown" && (
        <p className="mt-2 text-sm text-caution">
          We couldn&apos;t find that ZIP — try entering your USDA zone directly.
        </p>
      )}
      {resolvedZone != null && /^\d{5}$/.test(input) && (
        <p className="mt-2 text-xs text-ink-soft">
          ZIP {input} is in USDA zone {resolvedZone}.
        </p>
      )}
      {/* The yes/no answer pair.
          Three things are load-bearing here, all from GOL-3117:

          1. The mark is an inline SVG and sits OUTSIDE the sentence, aria-hidden.
             It used to be a literal U+2713 at the head of the string, which is
             the worst of both worlds: Dingbats is outside all three faces this
             app loads, so it painted an empty .notdef box for sighted users,
             and because it was inside the copy a screen reader announced it too.
             The sentence alone now carries the answer.
          2. The ink is a token (text-affirm / text-caution), not raw
             text-green-700 / text-amber-700 — those do not follow a retheme, and
             amber-700 specifically measured 3.93:1 on --paper-deep (GOL-678).
          3. The two states differ in SHAPE, not only hue: a check for in-range
             and a barred circle for out-of-range. A hardy/not-hardy answer told
             in green-vs-amber alone is meaning encoded in colour (WCAG 1.4.1),
             and the pair has to survive greyscale and all three CVD
             simulations. Same contract as the GOL-682 stock lines (● vs ✕).

          items-start, not items-center: both sentences wrap at 390px, and
          centring floats the mark to the middle of the wrapped block. */}
      {fits === true && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-affirm">
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
          Yes — this plant is hardy in your zone.
        </p>
      )}
      {fits === false && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-caution">
          <svg
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="6" cy="6" r="4.75" />
            <path d="M3.5 6h5" />
          </svg>
          <span>
            This plant is rated for {range}; zone {resolvedZone} may be outside its comfort range.
          </span>
        </p>
      )}
    </div>
  );
}
