"use client";

import Image from "next/image";
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
 * navigation and optimized images. Wrap any ui-kit surface that renders a
 * Link/Image in <GroveNextProviders> (must live under a "use client" boundary).
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
 * GOL-818 — re-encode quality for product photography. Catalog photos are
 * foliage/bark/texture-dense; next/image's default q75 smears exactly that
 * detail. 82 matches the nursery storefront's PRODUCT_IMAGE_QUALITY.
 */
const PRODUCT_IMAGE_QUALITY = 82;

/**
 * GOL-3477 — product images go through `next/image` when the caller reserves
 * an intrinsic size (every ui-kit ProductCard does): the optimizer serves a
 * resized AVIF/WebP from the `sizes` hint instead of the raw Odoo upload, and
 * `priority` turns the one above-the-fold card eager + fetchpriority=high so
 * the LCP image is no longer the last thing the browser schedules.
 *
 * Without width/height there is nothing to resize against, so fall back to a
 * plain lazy <img> rather than throw — next/image hard-errors on a missing
 * intrinsic size, and that is the pre-GOL-3477 behaviour for any other caller.
 */
function NextImageAdapter({
  src,
  alt,
  width,
  height,
  sizes,
  priority,
  className,
}: GroveImageProps) {
  if (width && height) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        // `priority` alone only preloads (<link rel=preload>) and drops the
        // lazy attribute; the img itself still needs fetchpriority=high so the
        // browser schedules it ahead of the other above-the-fold requests.
        priority={priority}
        fetchPriority={priority ? "high" : undefined}
        quality={PRODUCT_IMAGE_QUALITY}
        className={className}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

export function GroveNextProviders({ children }: { children: ReactNode }) {
  return (
    <GroveLinkProvider value={NextLinkAdapter}>
      <GroveImageProvider value={NextImageAdapter}>{children}</GroveImageProvider>
    </GroveLinkProvider>
  );
}
