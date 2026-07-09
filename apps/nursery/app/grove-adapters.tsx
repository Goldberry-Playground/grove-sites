"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GroveLinkProvider, type GroveLinkProps } from "@grove/ui-kit";

/**
 * GOL-139 — Next.js Link seam for @grove/ui-kit components in the nursery app.
 * ui-kit components read their Link from context; this supplies the real
 * next/link so migrated surfaces keep client-side navigation.
 */
function NextLinkAdapter({ href, children, ...rest }: GroveLinkProps) {
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

export function GroveNextLink({ children }: { children: ReactNode }) {
  return <GroveLinkProvider value={NextLinkAdapter}>{children}</GroveLinkProvider>;
}
