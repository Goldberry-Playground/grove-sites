import type { ReactNode } from "react";

/**
 * Coming-soon frame for the /visit sub-pages. The four programs are planned,
 * not yet running, so each page leads with an honest "Opening {when}" note
 * before the descriptive vision copy. Keeps the visitor from reading the page
 * as bookable-today (GOL-1584). Placed at the top of `.visit-body`.
 */
export function OpeningNotice({
  when,
  children,
}: {
  /** Target season, e.g. "Fall 2028". */
  when: string;
  /** One or two sentences on the timeline, in the Grove voice. */
  children: ReactNode;
}) {
  return (
    <aside className="visit-opening" role="note" aria-label={`Opening ${when}`}>
      <span className="visit-opening__badge">Opening {when}</span>
      <p className="visit-opening__note">{children}</p>
    </aside>
  );
}
