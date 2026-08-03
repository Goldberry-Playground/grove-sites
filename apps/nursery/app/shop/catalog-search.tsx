"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@grove/analytics";

export interface CatalogSearchProps {
  /** Current `?q=` value from the server, so the input reflects a shared/
   *  reloaded URL and the field survives a facet change. */
  initialQuery: string;
}

/**
 * Catalog search box for /shop (GOL-1111). Writes the query onto `?q=`,
 * MERGING it with the active facets (`URLSearchParams(searchParams)`) so search
 * composes with category/zone/tag instead of resetting them. The server page
 * re-reads `q` and narrows the grid, so results stay shareable and indexable.
 *
 * UX / a11y:
 *   • `role="search"` landmark + a labelled input (recognition over recall).
 *   • Submit on Enter or the Search button; a Clear (×) button appears once
 *     there's a query — forgiveness, one tap back to the full catalog.
 *   • `useTransition` drives a text "Searching…" cue (never colour-alone) and
 *     `aria-busy`, giving <400ms feedback while the server round-trips.
 */
export function CatalogSearch({ initialQuery }: CatalogSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the field in sync when the URL's `q` changes from outside this input
  // (back/forward, a shared link, or a facet change that rebuilds the page).
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    // Reset the grid-cap reveal on a new query — a fresh result set starts capped.
    params.delete("all");
    trackEvent("catalog_search", { q: trimmed || "(cleared)" });
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function clear() {
    setValue("");
    commit("");
    inputRef.current?.focus();
  }

  return (
    <form
      role="search"
      aria-label="Search the catalog"
      className="catalog-search"
      aria-busy={isPending}
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
    >
      <label htmlFor="catalog-search-input" className="sr-only">
        Search plants by name or type
      </label>
      <div className="catalog-search__row">
        <div className="catalog-search__field">
          <svg
            aria-hidden="true"
            className="catalog-search__icon"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <line x1="12.6" y1="12.6" x2="17.5" y2="17.5" />
          </svg>
          <input
            id="catalog-search-input"
            ref={inputRef}
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search by name or type — fig, apple, nut tree…"
            autoComplete="off"
            className="catalog-search__input"
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
        <button type="submit" className="catalog-search__submit">
          Search
        </button>
      </div>
      <p
        aria-live="polite"
        className={`catalog-search__status${isPending ? " is-pending" : ""}`}
      >
        {isPending ? "Searching…" : ""}
      </p>
    </form>
  );
}
