"use client";

import { useState } from "react";

/**
 * "Will this grow for me?" zone-check widget (design spec §"buy box" / ZIP-zone).
 *
 * v1 accepts a USDA hardiness zone directly and compares it to the plant's
 * zone_min..zone_max from the facts block — no backend dependency. The spec's
 * ZIP→zone lookup (backed by `zip_usda_zone.csv`) is a follow-up: it just
 * pre-fills this same comparison from a ZIP once the catalog API exposes the
 * endpoint. Renders nothing when the product has no zone data.
 */
export function ZoneCheck({ zoneMin, zoneMax }: { zoneMin: number | null; zoneMax: number | null }) {
  const [zone, setZone] = useState("");
  if (zoneMin == null && zoneMax == null) return null;

  const min = zoneMin ?? -Infinity;
  const max = zoneMax ?? Infinity;
  const parsed = /^\d+$/.test(zone) ? Number(zone) : null;
  const fits = parsed == null ? null : parsed >= min && parsed <= max;

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
          value={zone}
          onChange={(e) => setZone(e.target.value.trim())}
          placeholder="Your USDA zone"
          className="w-40 rounded border border-primary/20 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <span className="text-xs text-foreground/50">Hardy in {range}.</span>
      </div>
      {fits === true && (
        <p className="mt-2 text-sm text-green-700">✓ Yes — this plant is hardy in your zone.</p>
      )}
      {fits === false && (
        <p className="mt-2 text-sm text-amber-700">
          This plant is rated for {range}; zone {parsed} may be outside its comfort range.
        </p>
      )}
    </div>
  );
}
