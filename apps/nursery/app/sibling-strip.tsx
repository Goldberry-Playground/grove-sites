"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import type { Site } from "@grove/ui";

// Cross-village sibling-strip — persistent nav across the four sister sites.
// At desktop, renders as a horizontal pill row (all 4 sites visible).
// At mobile (max-width: 720px), collapses to a single toggle pill showing the
// current site; tap to reveal the other three. Tap outside or Escape to close.
// Markup is identical across all four apps; the only per-app differences are
// `currentSiteName` (which controls which pill renders as `.here`) and `sites`
// (passed by the parent server component so URLs match the current env --
// prod URLs on prod, QA URLs on qa.gatheringatthegrove.com, etc.). See
// `siblingSitesForHost` in @grove/ui for the resolution logic.

export function SiblingStrip({
  currentSiteName,
  sites,
}: {
  currentSiteName: string;
  sites: Site[];
}) {
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
