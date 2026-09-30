"use client";

import Link from "next/link";
import { useEffect } from "react";
import { JournalState } from "../../../components/JournalState";

/**
 * Outage surface for both journal routes (GOL-2803).
 *
 * Scoped to the `journal` segment so it also wraps `[slug]`. The detail route
 * deliberately re-throws a non-404 Ghost failure to land here: an outage is a
 * 500, and Next serves this boundary with that status on the first render —
 * which keeps crawlers from dropping a live essay the way the old catch-all
 * `notFound()` did.
 *
 * Nested under `(site)`, so the reader keeps the header, sibling strip and
 * footer. Being a Client Component is what buys the one thing an inline error
 * state cannot offer: `reset()` re-runs the render, so "Try again" is a real
 * retry rather than a full page reload.
 */
export default function JournalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The reader gets plain language; the detail goes to the server log.
    console.error("[hub/journal] render failed", error);
  }, [error]);

  return (
    <main className="journal-post">
      <JournalState
        kind="error"
        title="We can’t reach the journal"
        action={
          <>
            <button
              type="button"
              onClick={reset}
              className="btn-secondary journal-state__retry"
            >
              Try again
            </button>
            <Link href="/journal" className="journal-state__link">
              Back to the Journal
            </Link>
          </>
        }
      >
        The essay is still there &mdash; we just can&rsquo;t load it this minute.
        This is on our end, not yours.
      </JournalState>
    </main>
  );
}
