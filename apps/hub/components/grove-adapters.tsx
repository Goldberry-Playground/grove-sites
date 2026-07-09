"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  GroveImageProvider,
  GroveLinkProvider,
  type GroveImageProps,
  type GroveLinkProps,
} from "@grove/ui-kit";

/**
 * GOL-139 — Next.js injection seam for @grove/ui-kit components.
 *
 * ui-kit cards read their Link/Image from context (never importing `next/*`).
 * Hub supplies the real Next adapters here so migrated cards keep client-side
 * navigation and lazy images. Wrap any ui-kit surface that renders a Link/Image
 * in <GroveNextProviders> (must live under a "use client" boundary).
 */

/** next/link, adapted to the GroveLinkProps contract (href/className/aria-current). */
function NextLinkAdapter({ href, children, ...rest }: GroveLinkProps) {
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Plain lazy <img> — matches the pre-migration ProductCard behavior (raw <img
 * loading="lazy">, not next/image, which would demand intrinsic width/height).
 */
function NextImageAdapter({ src, alt, className }: GroveImageProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

export function GroveNextProviders({ children }: { children: ReactNode }) {
  return (
    <GroveLinkProvider value={NextLinkAdapter}>
      <GroveImageProvider value={NextImageAdapter}>{children}</GroveImageProvider>
    </GroveLinkProvider>
  );
}
