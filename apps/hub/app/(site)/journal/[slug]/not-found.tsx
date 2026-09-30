import Link from "next/link";
import { JournalState } from "../../../../components/JournalState";

/**
 * 404 for /journal/[slug] (GOL-2803).
 *
 * Route-scoped on purpose: `notFound()` resolves to the NEAREST `not-found.tsx`,
 * and the hub has none, so a stale link landed the reader on Next's default
 * black-on-white "This page could not be found" — off-brand, outside the site
 * chrome, and a dead end with no route back to the journal.
 */
export default function JournalPostNotFound() {
  return (
    <main className="journal-post">
      <JournalState
        kind="missing"
        title="We couldn’t find that essay"
        action={
          <Link href="/journal" className="journal-state__link">
            Back to the Journal
          </Link>
        }
      >
        The link may be out of date, or the note may have been taken down.
        Everything else the village has published is still there.
      </JournalState>
    </main>
  );
}
