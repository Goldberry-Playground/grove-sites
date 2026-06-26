"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface HeroSlide {
  /** Image URL (Unsplash or self-hosted). */
  url: string;
  /**
   * Slab tag line shown at the bottom of the image panel. The emphasis word is
   * marked inline by wrapping it in pipes, e.g. `"Slab № 0418 · |Black walnut| · …"`.
   */
  tag: string;
  /** The pipe-delimited word inside `tag` to render emphasized (accent-colored). */
  tagEmphasis: string;
}

export interface HeroSlideshowProps {
  /** Ordered slides to cycle through. */
  slides: HeroSlide[];
  /** Duration each slide is fully visible, in ms. */
  holdMs?: number;
  /** Crossfade transition duration, in ms. */
  fadeMs?: number;
}

/**
 * Auto-advancing crossfade hero slideshow. Presentational: slides arrive via a
 * typed prop, styling comes from `HeroSlideshow.css` (all `--grove-*` tokens).
 * Portable — no `next/*`.
 */
export function HeroSlideshow({ slides, holdMs = 5000, fadeMs = 1200 }: HeroSlideshowProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = holdMs + fadeMs;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [slides.length, holdMs, fadeMs]);

  if (slides.length === 0) return null;

  return (
    <div className="hero-slideshow" aria-live="off">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`hero-slide ${i === active ? "active" : ""}`}
          style={{ backgroundImage: `url('${slide.url}')` }}
          aria-hidden={i !== active}
        />
      ))}

      {/* Gradient overlay for readability */}
      <div className="hero-slide-overlay" aria-hidden="true" />

      {/* Slab tag — updates with the active slide */}
      <div className="hero-tag" key={active}>
        {renderTag(slides[active])}
      </div>

      {/* Slide indicator pips */}
      <div className="hero-pips" aria-hidden="true">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`hero-pip ${i === active ? "active" : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Parse the tag string and wrap the emphasis portion in <em>. */
function renderTag(slide: HeroSlide): ReactNode {
  const parts = slide.tag.split(`|${slide.tagEmphasis}|`);
  if (parts.length !== 2) return slide.tag;
  return (
    <>
      {parts[0]}
      <em>{slide.tagEmphasis}</em>
      {parts[1]}
    </>
  );
}
