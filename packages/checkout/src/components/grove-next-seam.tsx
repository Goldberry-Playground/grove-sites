"use client";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { GroveLinkProvider, type GroveLinkProps } from "@grove/ui-kit";

/**
 * Feeds `next/link` into the `@grove/ui-kit` Link seam so the lifted checkout
 * components get real client-side navigation (prefetch, no full reload) even
 * though the kit itself imports no `next/*`. Image stays the seam default (a
 * plain `<img>`) — the checkout thumbnails are fixed-size and were plain
 * `<img>` before the lift, so next/image's width/height/fill contract buys
 * nothing here. (Optimizing cart line images via next/image is a later step.)
 */
function NextGroveLink({ href, children, ...rest }: GroveLinkProps) {
  return (
    <NextLink href={href} {...rest}>
      {children}
    </NextLink>
  );
}

export function WithGroveNext({ children }: { children: ReactNode }) {
  return <GroveLinkProvider value={NextGroveLink}>{children}</GroveLinkProvider>;
}
