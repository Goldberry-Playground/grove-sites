"use client";

import { useEffect, useState } from "react";

interface Slide {
  /** Unsplash (or self-hosted) image URL */
  url: string;
  /** Slab tag line shown at the bottom of the image panel */
  tag: string;
  /** Amber-highlighted word inside the tag (species name) */
  tagEmphasis: string;
}

const SLIDES: Slide[] = [
  {
    url: "https://images.unsplash.com/photo-1736506159893-22cca29b8018?w=1800&auto=format&fit=crop&q=80",
    tag: "Slab № 0418 · |Black walnut| · 11ft × 38\" × 2.25\" · Air-dried 2yr",
    tagEmphasis: "Black walnut",
  },
  {
    url: "https://images.unsplash.com/photo-1589318549101-41a51f4ede6b?w=1800&auto=format&fit=crop&q=80",
    tag: "Board lot № 0612 · |Black cherry| · 6 boards × 8ft · Air-dried 1yr",
    tagEmphasis: "Black cherry",
  },
  {
    url: "https://images.unsplash.com/photo-1667689815944-9f72c0f59e74?w=1800&auto=format&fit=crop&q=80",
    tag: "WoodMizer LT40 · |Portable sawmill| · Milling on-site at the Grove",
    tagEmphasis: "Portable sawmill",
  },
  {
    url: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=1800&auto=format&fit=crop&q=80",
    tag: "Board lot № 0901 · |White oak| · 12 boards · Quarter-sawn · Barn beam",
    tagEmphasis: "White oak",
  },
  {
    url: "https://images.unsplash.com/reserve/K9PZheO1RSiNMMP1ptsl_wood.jpg?w=1800&auto=format&fit=crop&q=80",
    tag: "Slab stack · |Air-drying| · Under cover at the lower barn · 18 months",
    tagEmphasis: "Air-drying",
  },
];

/** Duration each slide is fully visible (ms) */
const HOLD = 5000;
/** Crossfade transition duration (ms) */
const FADE = 1200;
const INTERVAL = HOLD + FADE;

export function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-slideshow" aria-live="off">
      {SLIDES.map((slide, i) => (
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
        {renderTag(SLIDES[active])}
      </div>

      {/* Slide indicator pips */}
      <div className="hero-pips" aria-hidden="true">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`hero-pip ${i === active ? "active" : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Parse the tag string and wrap the emphasis portion in <em> */
function renderTag(slide: Slide) {
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
