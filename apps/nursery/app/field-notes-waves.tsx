"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { FieldNoteWave } from "../lib/preorder-waves";

const HEADINGS = {
  fall: "Fall shipping pre-orders",
  spring: "Spring shipping pre-orders",
} as const;

const TAB_LABELS = { fall: "Fall", spring: "Spring" } as const;

function WaveList({ rows }: { rows: FieldNoteWave["rows"] }) {
  return (
    <ul>
      {rows.map(({ zone, label, note }) => (
        <li key={zone}>
          <span>Zone {zone}</span>
          <strong>{label}</strong>
          <small>{note}</small>
        </li>
      ))}
    </ul>
  );
}

/**
 * Homepage Field Notes wave lists (Josh 2026-11-02). Two open waves → one
 * swipeable panel: a native scroll-snap track with Fall/Spring tabs and dots,
 * no carousel library. One open wave (e.g. after the last fall order-by) →
 * that list alone. The rows are computed server-side by `fieldNoteWaves`.
 */
export function FieldNotesWaves({ waves }: { waves: FieldNoteWave[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  if (waves.length === 1) {
    const [only] = waves;
    return (
      <div className="field-notes-wave">
        <h4>{HEADINGS[only.wave]}</h4>
        <WaveList rows={only.rows} />
      </div>
    );
  }

  const goTo = (i: number, focus = false) => {
    setActive(i);
    if (focus) tabRefs.current[i]?.focus();
    const track = trackRef.current;
    if (!track || typeof track.scrollTo !== "function") return;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  // Follow the swipe: the slide nearest the scroll position is the active tab.
  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active && i >= 0 && i < waves.length) setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = waves.length - 1;
    const next =
      e.key === "ArrowRight" ? Math.min(active + 1, last)
      : e.key === "ArrowLeft" ? Math.max(active - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    goTo(next, true);
  };

  return (
    <div className="field-notes-slider">
      <div
        className="field-notes-tabs"
        role="tablist"
        aria-label="Shipping pre-order waves"
        onKeyDown={onKeyDown}
      >
        {waves.map(({ wave }, i) => (
          <button
            key={wave}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`fn-tab-${wave}`}
            aria-selected={i === active}
            aria-controls={`fn-panel-${wave}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => goTo(i)}
          >
            {TAB_LABELS[wave]}
          </button>
        ))}
      </div>
      <div className="field-notes-track" ref={trackRef} onScroll={onScroll}>
        {waves.map(({ wave, rows }) => (
          <div
            key={wave}
            className="field-notes-slide"
            role="tabpanel"
            id={`fn-panel-${wave}`}
            aria-labelledby={`fn-tab-${wave}`}
          >
            <h4 className="sr-only">{HEADINGS[wave]}</h4>
            <WaveList rows={rows} />
          </div>
        ))}
      </div>
      <div className="field-notes-dots" aria-hidden="true">
        {waves.map(({ wave }, i) => (
          <span key={wave} className={i === active ? "is-active" : undefined} />
        ))}
        <small>{active === 0 ? "Swipe for spring" : "Swipe back for fall"}</small>
      </div>
    </div>
  );
}
