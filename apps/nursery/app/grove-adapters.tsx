"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { GroveLinkProvider, type GroveLinkProps } from "@grove/ui-kit";

/**
 * Per-link pending cue for category-bar pills (GOL-1111). `useLinkStatus` reports
 * the in-flight state of its nearest ancestor <Link>, so tapping a plant-type
 * pill shows immediate feedback (<400ms, Doherty Threshold) while the server
 * page re-renders — no more dead-click gap. Rendered inside every ui-kit Link,
 * but only visible while that link is navigating; idle links show nothing and
 * reserve no space. The signal is the spinner's PRESENCE (shape, not colour), so
 * it holds under color-blindness; reduced-motion drops the spin but keeps the dot.
 */
function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="cat-pill-pending" aria-hidden="true" />;
}

/**
 * GOL-139 — Next.js Link seam for @grove/ui-kit components in the nursery app.
 * ui-kit components read their Link from context; this supplies the real
 * next/link so migrated surfaces keep client-side navigation.
 */
function NextLinkAdapter({ href, children, ...rest }: GroveLinkProps) {
  return (
    <Link href={href} {...rest}>
      {children}
      <LinkPending />
    </Link>
  );
}

export function GroveNextLink({ children }: { children: ReactNode }) {
  return <GroveLinkProvider value={NextLinkAdapter}>{children}</GroveLinkProvider>;
}
