import type { GrowingFacts } from "@grove/odoo-client";

/**
 * Growing-facts spec block (design spec §"Page anatomy"): Zones · Mature size ·
 * Spacing · Sun · Soil · Layer, sourced from Odoo `grove_*` fields via the
 * catalog API `facts` block. Rows with no value are omitted so a sparsely-filled
 * product doesn't render a wall of "—". Renders nothing when facts are absent
 * (list-only products / older API) so commerce never blocks on content.
 */
export function SpecBlock({ facts }: { facts?: GrowingFacts }) {
  if (!facts) return null;

  const zones =
    facts.zoneMin != null && facts.zoneMax != null
      ? `${facts.zoneMin}–${facts.zoneMax}`
      : facts.zoneMin != null
        ? `${facts.zoneMin}+`
        : null;

  const rows: Array<[string, string | null]> = [
    ["USDA Zones", zones],
    ["Mature size", facts.matureSize],
    ["Spacing", facts.spacing],
    ["Sun", capitalize(facts.sun)],
    ["Soil", facts.soil],
    ["Layer", capitalize(facts.layer)],
  ];
  const present = rows.filter(([, v]) => v != null && v !== "");
  if (present.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="spec-heading">
      <h2 id="spec-heading" className="text-lg font-display font-semibold text-foreground mb-4">
        Growing specs
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-primary/10 bg-secondary/10 p-5">
        {present.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-primary/5 pb-2 last:border-0">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="text-sm font-medium text-foreground text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {facts.botanicalName && (
        <p className="mt-3 text-xs italic text-ink-soft">{facts.botanicalName}</p>
      )}
    </section>
  );
}

function capitalize(v: string | null): string | null {
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}
