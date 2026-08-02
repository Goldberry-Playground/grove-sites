"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@grove/analytics";

/**
 * Free-text catalog search for /shop (QA 2026-07-31 — the Apple bucket alone
 * carries dozens of varieties, so "scroll or facet your way there" was the only
 * find path). Writes the term to the shareable `?q=` param; the server page
 * re-reads it and filters (name + botanical + tags) so the URL stays the source
 * of truth and the result is linkable/indexable.
 *
 * The input is debounced so every keystroke doesn't push a history entry, and
 * uses `router.replace` (not push) so the back button returns to the pre-search
 * catalog in one step rather than unwinding each character.
 *
 * Accessibility: a real labelled `type="search"` field (native clear affordance
 * + Escape to clear), a visible clear button with an accessible name, and an
 * `aria-live` result count so screen-reader users hear the list update. Meaning
 * never rides on colour alone.
 */
export interface CatalogSearchProps {
  /** Current `?q=` value from the server, so the field is correct on first paint. */
  initialQuery: string;
  /** Number of products currently shown, announced politely as the query changes. */
  resultCount: number;
}

const DEBOUNCE_MS = 250;

export function CatalogSearch({ initialQuery, resultCount }: CatalogSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  // Track the last term we pushed so external navigations (e.g. a facet change
  // that keeps ?q=) re-sync the field without clobbering in-flight typing.
  const lastPushed = useRef(initialQuery);

  // Keep the field in sync when the URL's q changes underneath us (back/forward,
  // a pill click that preserves the search). Only adopt the URL value when it
  // differs from what we last wrote, so mid-type state isn't stomped.
  useEffect(() => {
    if (initialQuery !== lastPushed.current) {
      setValue(initialQuery);
      lastPushed.current = initialQuery;
    }
  }, [initialQuery]);

  useEffect(() => {
    const next = value.trim();
    if (next === lastPushed.current.trim()) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      lastPushed.current = next;
      if (next) trackEvent("catalog_search", { q: next });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  function clear() {
    setValue("");
  }

  return (
    <div className="catalog-search">
      <label htmlFor="catalog-search-input" className="catalog-search__label">
        Search the catalog
      </label>
      <div className="catalog-search__field">
        <svg
          className="catalog-search__icon"
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8.5 3a5.5 5.5 0 0 1 4.23 9.02l3.62 3.63a.75.75 0 0 1-1.06 1.06l-3.63-3.62A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
            fill="currentColor"
          />
        </svg>
        <input
          id="catalog-search-input"
          type="search"
          inputMode="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") clear();
          }}
          placeholder="Search by name, type, or use (e.g. apple, pawpaw)"
          className="catalog-search__input"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="catalog-search__clear"
            aria-label="Clear search"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {/* Politely announce the result count as the query settles. */}
      <p className="catalog-search__status" aria-live="polite">
        {value.trim()
          ? `${resultCount} ${resultCount === 1 ? "variety" : "varieties"} match “${value.trim()}”`
          : ""}
      </p>
    </div>
  );
}
