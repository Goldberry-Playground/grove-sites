"use client";

import { HeroSlideshow as UiHeroSlideshow, type HeroSlide } from "@grove/ui-kit";

const SLIDES: HeroSlide[] = [
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

/**
 * Thin wrapper: ggg slide data is app-local (woodworking slab inventory);
 * the slideshow mechanics (auto-advance, reduced-motion, pause/play a11y,
 * pips-as-tablist) live in @grove/ui-kit HeroSlideshow. GOL-139.
 */
export function HeroSlideshow() {
  return <UiHeroSlideshow slides={SLIDES} />;
}
