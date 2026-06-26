"use client";

import { useEffect, useRef, useState } from "react";
import { useGroveLink } from "../link-context";

/** One sister site in the cross-village strip. */
export type SiblingSite = {
  /** Display name; also matches against `currentSiteName` to mark the active pill. */
  name: string;
  /** Absolute URL to the sibling site (env-resolved by the app). */
  href: string;
};

export type SiblingStripProps = {
  /** Name of the site currently being viewed — its pill renders as `.here`. */
  currentSiteName: string;
  /** All four sister sites, in render order. */
  sites: SiblingSite[];
};

/**
 * Cross-village sibling-strip — persistent nav across the four sister sites.
 * Desktop: a horizontal pill row (all sites visible). Mobile (max-width 720px):
 * collapses to a single toggle pill showing the current site; tap to reveal the
 * others, tap outside or Escape to close.
 *
 * Portable: no `next/*`. The active site's pill links home via the injected
 * Grove Link; the others are plain `<a>` cross-origin links. Styled against
 * `--grove-*` roles (see SiblingStrip.css).
 */
export function SiblingStrip({ currentSiteName, sites }: SiblingStripProps) {
  const Link = useGroveLink();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className={`sibling-strip ${open ? "is-open" : ""}`}>
      {/* Mobile-only toggle. Hidden on desktop via CSS. */}
      <button
        type="button"
        className="sibling-strip__toggle"
        aria-expanded={open}
        aria-controls="sibling-strip-list"
        aria-haspopup="true"
        aria-label={`${currentSiteName} — tap to switch sites`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="here">{currentSiteName}</span>
        <span className="sibling-strip__caret" aria-hidden>
          ▾
        </span>
      </button>
      <ul id="sibling-strip-list" className="sibling-strip__list">
        {sites.map((site) => {
          const isCurrent = site.name === currentSiteName;
          return (
            <li key={site.name}>
              {isCurrent ? (
                <Link href="/" className="here">
                  {site.name}
                </Link>
              ) : (
                <a href={site.href}>{site.name}</a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
