"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@grove/analytics";
import { ZONE_OPTIONS, type FacetOption } from "../../lib/facets";

export interface TypeOption {
  slug: string;
  label: string;
  count: number;
}

export interface FacetSidebarProps {
  types: TypeOption[];
  tags: FacetOption[];
  activeCat: string | null;
  activeZone: number | null;
  activeTags: string[];
}

/**
 * URL-param-driven facet sidebar for /shop (design spec §"Mechanics — Facets").
 * Selections are pushed onto the query string (`cat` / `zone` / `tag`) so the
 * filtered view is shareable and indexable; the server page re-reads them and
 * re-filters. Every change emits a Plausible `filter_applied {facet, value}`
 * custom event — the spec's zero-infra analytics for "which facets get used".
 */
export function FacetSidebar({ types, tags, activeCat, activeZone, activeTags }: FacetSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  function toggleTag(tag: string) {
    const next = new URLSearchParams(searchParams.toString());
    const current = next.getAll("tag");
    next.delete("tag");
    const after = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    for (const t of after) next.append("tag", t);
    commit(next, "tag", tag);
  }

  const hasFilters = activeCat !== null || activeZone !== null || activeTags.length > 0;

  return (
    <aside className="w-full md:w-56 shrink-0" aria-label="Filters">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">Filter</h2>
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

      {/* Type (plant category) */}
      <FacetGroup label="Type">
        <ul className="space-y-1">
          {types.map((t) => {
            const active = t.slug === activeCat;
            return (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => setSingle("cat", active ? null : t.slug, "type")}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition ${
                    active ? "bg-primary/10 text-primary font-medium" : "text-foreground/75 hover:bg-secondary/20"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="text-xs text-foreground/40">{t.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </FacetGroup>

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

      {/* Usage tags */}
      {tags.length > 0 && (
        <FacetGroup label="Tags">
          <ul className="space-y-1">
            {tags.map((tag) => (
              <li key={tag.value}>
                <label className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm text-foreground/75 hover:bg-secondary/20">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tag.active}
                      onChange={() => toggleTag(tag.value)}
                      className="accent-primary"
                    />
                    {tag.value}
                  </span>
                  <span className="text-xs text-foreground/40">{tag.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </FacetGroup>
      )}
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</h3>
      {children}
    </div>
  );
}
