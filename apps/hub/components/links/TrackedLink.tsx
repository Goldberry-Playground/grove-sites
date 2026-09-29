"use client";

import { trackEvent } from "@grove/analytics";

/** An outbound link on /links that records which card or icon was tapped. */
export function TrackedLink({
  track,
  source,
  ...anchor
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { track: string; source: string }) {
  return (
    <a {...anchor} onClick={() => trackEvent("links_click", { target: track, source })} />
  );
}
