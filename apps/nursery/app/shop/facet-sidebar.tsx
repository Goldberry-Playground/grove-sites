"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@grove/analytics";
import { ZONE_OPTIONS, LAYER_OPTIONS, SUN_OPTIONS, type FacetOption } from "../../lib/facets";

export interface FacetSidebarProps {
  activeCat: string | null;
  activeZone: number | null;
  activeTags: string[];
  activeLayer: string | null;
  activeSun: string | null;
}

/** Sentence-case a facet value for its option label ("understory" → "Understory"). */
function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * URL-param-driven facet sidebar for /shop (design spec §"Mechanics — Facets").
 * Selections are pushed onto the query string (`cat` / `zone` / `tag`) so the
 * filtered view is shareable and indexable; the server page re-reads them and
 * re-filters. Every change emits a Plausible `filter_applied {facet, value}`
 * custom event — the spec's zero-infra analytics for "which facets get used".
 */
export function FacetSidebar({
  activeCat,
  activeZone,
  activeTags,
  activeLayer,
  activeSun,
}: FacetSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Progressive disclosure (GOL-682 #3): on mobile the facet panel used to push
  // the first product ~1.5 screens down, so it's collapsed behind a "Filter"
  // toggle below the `md` breakpoint. On `md`+ the `md:block` on the body always
  // wins over this state, so the panel is permanently open on desktop and the
  // toggle is hidden — the state only drives the mobile view.
  const [open, setOpen] = useState(false);

  function commit(next: URLSearchParams, facet: string, value: string) {
    trackEvent("filter_applied", { facet, value });
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setSingle(key: string, value: string | null, facet: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    commit(next, facet, value ?? "(cleared)");
  }

  const activeCount =
    (activeCat !== null ? 1 : 0) +
    (activeZone !== null ? 1 : 0) +
    activeTags.length +
    (activeLayer !== null ? 1 : 0) +
    (activeSun !== null ? 1 : 0);
  const hasFilters = activeCount > 0;

  return (
    <aside className="w-full md:w-56 shrink-0" aria-label="Filters">
      <div className="flex items-center justify-between gap-3 mb-4">
        {/* Mobile: the heading doubles as the disclosure toggle. Desktop: the
            toggle is hidden (`md:hidden`) and this row is just the label + Clear. */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="facet-panel"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground/70 md:pointer-events-none md:cursor-default"
        >
          <span aria-hidden="true" data-open={open} className="facet-caret md:hidden" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground md:hidden">
              {activeCount}
            </span>
          )}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              trackEvent("filter_applied", { facet: "clear", value: "all" });
              router.push(pathname, { scroll: false });
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div id="facet-panel" className={`${open ? "block" : "hidden"} md:block`}>
      {/* Zone (server-side filter via catalog API `zone`) */}
      <FacetGroup label="Hardiness zone">
        <select
          value={activeZone ?? ""}
          onChange={(e) => setSingle("zone", e.target.value || null, "zone")}
          className="w-full rounded border border-primary/20 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          aria-label="Filter by USDA hardiness zone"
        >
          <option value="">Any zone</option>
          {ZONE_OPTIONS.map((z) => (
            <option key={z} value={z}>
              Zone {z}
            </option>
          ))}
        </select>
      </FacetGroup>

      {/* Layer (server-side filter via catalog API `layer`) */}
      <FacetGroup label="Food-forest layer">
        <select
          value={activeLayer ?? ""}
          onChange={(e) => setSingle("layer", e.target.value || null, "layer")}
          className="w-full rounded border border-primary/20 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          aria-label="Filter by food-forest layer"
        >
          <option value="">Any layer</option>
          {LAYER_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {titleCase(l)}
            </option>
          ))}
        </select>
      </FacetGroup>

      {/* Sun (server-side filter via catalog API `sun`) */}
      <FacetGroup label="Sun">
        <select
          value={activeSun ?? ""}
          onChange={(e) => setSingle("sun", e.target.value || null, "sun")}
          className="w-full rounded border border-primary/20 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          aria-label="Filter by sun requirement"
        >
          <option value="">Any sun</option>
          {SUN_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
      </FacetGroup>

      </div>
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</h3>
      {children}
    </div>
  );
}
