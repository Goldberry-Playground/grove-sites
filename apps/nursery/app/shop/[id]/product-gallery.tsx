"use client";

import Image from "next/image";
import { ProductImage } from "../../product-image";

/** Serializable gallery image (URLs pre-resolved to absolute on the server). */
export interface ViewImage {
  id: number;
  url: string;
  thumbUrl: string;
}

/**
 * PDP hero image + thumbnail strip, shared by the tree buy box and the seed
 * pre-order view (GOL-3258) so both pages keep one gallery treatment. The
 * caller owns which image is showing; a thumbnail click reports its URL.
 */
export function ProductGallery({
  name,
  featured,
  hero,
  thumbs,
  activeUrl,
  onPick,
}: {
  name: string;
  featured: boolean;
  /** The image the hero frame shows. */
  hero: string;
  thumbs: ViewImage[];
  /** URL of the thumbnail to mark active. */
  activeUrl: string;
  onPick: (url: string) => void;
}) {
  return (
    <div>
      <div className="relative aspect-square bg-secondary/20 rounded-lg overflow-hidden">
        <ProductImage src={hero} alt={name} sizes="(max-width: 768px) 100vw, 50vw" priority />
        {featured && (
          <span className="absolute top-3 right-3 bg-accent text-white text-xs font-medium px-2 py-1 rounded">
            Featured
          </span>
        )}
      </div>
      {thumbs.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto" role="list" aria-label="Product images">
          {thumbs.map((img) => {
            const isActive = activeUrl === img.url;
            return (
              <button
                key={img.id}
                type="button"
                role="listitem"
                onClick={() => onPick(img.url)}
                aria-pressed={isActive}
                aria-label="Show image"
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border transition ${
                  isActive ? "border-primary" : "border-primary/10 hover:border-primary/40"
                }`}
              >
                <Image src={img.thumbUrl} alt="" fill className="object-cover" sizes="64px" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The thumbnail list: the gallery, or the hero alone when there is none. */
export function galleryThumbs(images: ViewImage[], heroImage: string): ViewImage[] {
  if (images.length > 0) return images;
  return heroImage ? [{ id: -1, url: heroImage, thumbUrl: heroImage }] : [];
}
