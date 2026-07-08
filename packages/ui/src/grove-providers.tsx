"use client";

/**
 * The Next.js adapter for the @grove/ui-kit injection seam. Wrap an app's tree
 * in <GroveProviders> so every grove-ui-kit component (SiblingStrip, NavLink,
 * ProductCard, …) resolves `useGroveLink()` → next/link and `useGroveImage()`
 * → next/image, instead of the plain <a>/<img> defaults used in Storybook and
 * Claude Design.
 */
import type { ReactNode } from "react";
import NextLink from "next/link";
import NextImage from "next/image";
import {
  GroveLinkProvider,
  GroveImageProvider,
  type GroveLinkProps,
  type GroveImageProps,
} from "@grove/ui-kit";

function LinkAdapter({ href, children, ...rest }: GroveLinkProps) {
  return (
    <NextLink href={href} {...rest}>
      {children}
    </NextLink>
  );
}

function ImageAdapter({ src, alt, width, height, className }: GroveImageProps) {
  // grove-ui-kit components pass explicit width/height; fall back so a missing
  // dimension never crashes next/image.
  return (
    <NextImage
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 800}
      className={className}
    />
  );
}

export function GroveProviders({ children }: { children: ReactNode }) {
  return (
    <GroveLinkProvider value={LinkAdapter}>
      <GroveImageProvider value={ImageAdapter}>{children}</GroveImageProvider>
    </GroveLinkProvider>
  );
}
