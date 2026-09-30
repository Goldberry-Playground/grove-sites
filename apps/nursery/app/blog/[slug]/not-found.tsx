import Link from "next/link";
import { tenantConfig } from "../../../tenant.config";

/**
 * 404 for /blog/[slug] (GOL-2788).
 *
 * Route-scoped on purpose: `notFound()` from the post route resolves to the
 * nearest `not-found.tsx`, and without this the reader lands on Next's default
 * black-on-white "This page could not be found" — off-brand, and a dead end.
 *
 * Third member of the `.journal-state` family, and it must be tellable from the
 * other two WITHOUT colour (WCAG 1.4.1): distinct icon SHAPE (a searched-and-
 * empty page, vs the error triangle and the empty-state sprout), distinct
 * heading text, and a distinct border style (dotted, vs solid error / dashed
 * empty). Neutral ink, not the alarm colour — nothing is broken here.
 */
export default function BlogPostNotFound() {
  return (
    <div className="journal-post">
      <div role="status" className="journal-state journal-missing">
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
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
          <path d="M14 3v5h5" />
          <circle cx="17.5" cy="16.5" r="3.5" />
          <path d="m20.2 19.2 2.3 2.3" />
        </svg>
        <p className="journal-state__title">We couldn&rsquo;t find that entry</p>
        <p className="journal-state__body">
          The link may be out of date, or the note may have been taken down.
          Everything else we&rsquo;ve published is still there.
        </p>
        <Link href="/blog" className="journal-state__link">
          Back to {tenantConfig.copy.blogHeading}
        </Link>
      </div>
    </div>
  );
}
