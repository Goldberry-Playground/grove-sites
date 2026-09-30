import type { ReactNode } from "react";

/**
 * The hub journal's three "no article here" outcomes (GOL-2803).
 *
 * EMPTY    — nothing has been published yet.
 * ERROR    — we could not reach Ghost. Different fact, different copy: telling
 *            a reader "no posts yet" when the truth is "we cannot look right
 *            now" is a lie, and it is the bug this component exists to kill.
 * MISSING  — Ghost answered, and that slug genuinely is not there (404).
 *
 * ACCESSIBILITY CONTRACT (WCAG 1.4.1, and the reason this is one component
 * rather than three ad-hoc blocks): the three are told apart by ICON SHAPE +
 * HEADING TEXT + BORDER STYLE — dotted / dashed / solid. Colour is the fourth,
 * weakest cue only. Strip the colour and all three still read; that is checked
 * in page.test.tsx and verified in grayscale, deuteranopia, protanopia and
 * tritanopia.
 *
 * Presentational only — no hooks, no "use client" — so the Server Components
 * (list, detail) and the Client error boundary (error.tsx) share one copy.
 */
export type JournalStateKind = "empty" | "error" | "missing";

const ICONS: Record<JournalStateKind, ReactNode> = {
  // A seedling breaking ground: something is coming.
  empty: (
    <>
      <path d="M7 20h10" />
      <path d="M12 20v-9" />
      <path d="M12 11C12 7 9 4 4 4c0 5 3 7 8 7Z" />
      <path d="M12 13c0-3 2.5-5.5 7-5.5 0 4-2.5 5.5-7 5.5Z" />
    </>
  ),
  // An alert triangle: something on our side is wrong.
  error: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  // A page with a magnifier: we looked, and it is not here.
  missing: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
      <path d="M14 3v5h5" />
      <circle cx="17.5" cy="16.5" r="3.5" />
      <path d="m20.2 19.2 2.3 2.3" />
    </>
  ),
};

export function JournalState({
  kind,
  title,
  children,
  action,
}: {
  kind: JournalStateKind;
  title: string;
  /** The explanation. Plain language — say what happened and whose fault it is. */
  children: ReactNode;
  /** The way out. Every one of these states is a dead end without it. */
  action?: ReactNode;
}) {
  return (
    <div
      // An outage is the only one of the three that interrupts: it is the only
      // assertive role. "Nothing published yet" and "that link is stale" are
      // statements of fact, not alarms.
      role={kind === "error" ? "alert" : "status"}
      className={`journal-state journal-${kind}`}
    >
      <svg
        className="journal-state__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICONS[kind]}
      </svg>
      <p className="journal-state__title">{title}</p>
      <p className="journal-state__body">{children}</p>
      {action && <p className="journal-state__action">{action}</p>}
    </div>
  );
}
