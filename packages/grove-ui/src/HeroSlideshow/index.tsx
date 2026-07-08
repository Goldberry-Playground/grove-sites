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
  /**
   * Optional text alternative describing the slide's image. When present it is
   * rendered into a visually-hidden caption so screen readers can announce the
   * slide's purpose (WCAG 1.1.1). Omit for purely decorative slides.
   */
  alt?: string;
}

export interface HeroSlideshowProps {
  /** Ordered slides to cycle through. */
  slides: HeroSlide[];
  /** Duration each slide is fully visible, in ms. */
  holdMs?: number;
  /** Crossfade transition duration, in ms. */
  fadeMs?: number;
}

/** Whether the user has requested reduced motion (SSR-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Auto-advancing crossfade hero slideshow. Presentational: slides arrive via a
 * typed prop, styling comes from `HeroSlideshow.css` (all `--grove-*` tokens).
 * Portable — no `next/*`.
 */
export function HeroSlideshow({ slides, holdMs = 5000, fadeMs = 1200 }: HeroSlideshowProps) {
  const [active, setActive] = useState(0);
  // Default-paused for reduced-motion users; everyone else auto-advances (§3, WCAG 2.2.2 / 2.3.1).
  const [paused, setPaused] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    if (paused || slides.length <= 1) return; // gate the timer on `paused`
    const interval = holdMs + fadeMs;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [paused, slides.length, holdMs, fadeMs]);

  if (slides.length === 0) return null;

  const activeSlide = slides[active];

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

      {/* Visually-hidden caption — text alternative for the active slide
          (§5, WCAG 1.1.1). */}
      {activeSlide?.alt ? <p className="sr-only">{activeSlide.alt}</p> : null}

      {/* Slab tag — updates with the active slide */}
      <div className="hero-tag" key={active}>
        {renderTag(activeSlide)}
      </div>

      {/* Pause/play control (§3) */}
      {slides.length > 1 ? (
        <button
          type="button"
          className="hero-playpause"
          aria-label={paused ? "Play slideshow" : "Pause slideshow"}
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        />
      ) : null}

      {/* Slide indicator dots — exposed to AT as a tablist (§4, WCAG 1.3.1 / 4.1.2) */}
      <div className="hero-pips" role="tablist" aria-label="Choose slide">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Slide ${i + 1} of ${slides.length}`}
            className={`hero-pip ${i === active ? "active" : ""}`}
            onClick={() => setActive(i)}
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
