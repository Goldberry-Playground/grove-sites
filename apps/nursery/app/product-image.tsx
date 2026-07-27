"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * GOL-818 — re-encode quality for product photography.
 *
 * next/image defaults to `quality={75}`. Our catalog photos are foliage- and
 * texture-dense (leaves, bark, grass, fruit skin — all high-frequency detail),
 * exactly the content WebP/AVIF at q75 smears into mush, so real photos read
 * "soft"/"low-res" on the storefront even when the *source* resolution is fine
 * (audited on nursery.qa: Apple's 1445px source loads in full at DPR2, yet the
 * q75 re-encode still looked hazy). Bumping to 82 recovers that crispness for
 * ~24% more bytes per image — a sound trade for a photo-first plant nursery.
 * 90+ was double the payload for a marginal gain. This is the rendering-side
 * lever; low-resolution *source* photos still need higher-res uploads to Odoo.
 */
export const PRODUCT_IMAGE_QUALITY = 82;

export interface ProductImageProps {
  /** Resolved image URL, or empty/null when the catalog has no photo yet. */
  src?: string | null;
  /** Describes the plant for assistive tech when a real photo is shown. */
  alt: string;
  /** next/image `sizes` hint for the responsive grid/hero srcset. */
  sizes?: string;
  /** Above-the-fold hero image opts out of lazy loading. */
  priority?: boolean;
}

/**
 * GOL-680 — product imagery with a branded botanical fallback.
 *
 * The nursery catalog is photo-first (for a plant nursery, appearance is the
 * primary buying cue), but many products have no photo yet. The storefront was
 * rendering the browser's gray broken-image glyph — the biggest trust gap in
 * the store. This renders a real `next/image` when a usable src exists and
 * falls back — on an EMPTY src OR a load error — to a brand-token botanical
 * placeholder instead of the default gray box.
 *
 * Note: Odoo (`grove_headless`) currently serves its own gray placeholder at
 * HTTP 200 for imageless products, so `onError` can't catch those; the root fix
 * is `grove_headless` returning a null `image_url` when no image is set (see the
 * sibling backend/content issue). This component is the rendering target for
 * that null, and independently covers genuine 404s, CDN misses, and offline.
 */
export function ProductImage({ src, alt, sizes, priority }: ProductImageProps) {
  const [errored, setErrored] = useState(false);
  const showPhoto = Boolean(src) && !errored;

  if (showPhoto) {
    return (
      <Image
        src={src as string}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={PRODUCT_IMAGE_QUALITY}
        className="product-photo"
        onError={() => setErrored(true)}
      />
    );
  }

  // Decorative: the adjacent product name already names the plant, so the
  // placeholder is aria-hidden to avoid a redundant screen-reader announcement.
  return (
    <div className="product-ph" aria-hidden="true">
      <svg
        className="product-ph__mark"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 44 V20" />
        <path d="M24 33 C 15 33 11 27 11 22 C 18 22 24 25 24 33 Z" />
        <path d="M24 32 L 15 25" />
        <path d="M24 27 C 33 27 37 21 37 16 C 30 16 24 19 24 27 Z" />
        <path d="M24 26 L 33 19" />
        <path d="M24 21 C 24 12 28 7 33 6 C 33 13 30 19 24 21 Z" />
        <path d="M24 20 L 30 11" />
        <path d="M15 44 H 33" opacity="0.5" />
      </svg>
      <span className="product-ph__label">Photo coming soon</span>
    </div>
  );
}
