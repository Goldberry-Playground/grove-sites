import { HeroSlideshow as UiHeroSlideshow, type HeroSlide } from "@grove/ui-kit";

/**
 * GGG hero slideshow (GOL-139). The auto-advancing crossfade + a11y behavior
 * (pause/play, reduced-motion default-pause, tablist pips) now lives in
 * @grove/ui-kit's HeroSlideshow; this file just supplies GGG's slab imagery.
 * `alt` gives each slide a screen-reader text alternative (WCAG 1.1.1).
 */
const SLIDES: HeroSlide[] = [
  {
    url: "https://images.unsplash.com/photo-1736506159893-22cca29b8018?w=1800&auto=format&fit=crop&q=80",
    tag: "Slab № 0418 · |Black walnut| · 11ft × 38\" × 2.25\" · Air-dried 2yr",
    tagEmphasis: "Black walnut",
    alt: "A wide live-edge black walnut slab, air-dried two years.",
  },
  {
    url: "https://images.unsplash.com/photo-1589318549101-41a51f4ede6b?w=1800&auto=format&fit=crop&q=80",
    tag: "Board lot № 0612 · |Black cherry| · 6 boards × 8ft · Air-dried 1yr",
    tagEmphasis: "Black cherry",
    alt: "A stacked lot of six black cherry boards, eight feet long.",
  },
  {
    url: "https://images.unsplash.com/photo-1667689815944-9f72c0f59e74?w=1800&auto=format&fit=crop&q=80",
    tag: "WoodMizer LT40 · |Portable sawmill| · Milling on-site at the Grove",
    tagEmphasis: "Portable sawmill",
    alt: "A WoodMizer LT40 portable sawmill milling a log on-site at the Grove.",
  },
  {
    url: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=1800&auto=format&fit=crop&q=80",
    tag: "Board lot № 0901 · |White oak| · 12 boards · Quarter-sawn · Barn beam",
    tagEmphasis: "White oak",
    alt: "Twelve quarter-sawn white oak boards from a reclaimed barn beam.",
  },
  {
    url: "https://images.unsplash.com/reserve/K9PZheO1RSiNMMP1ptsl_wood.jpg?w=1800&auto=format&fit=crop&q=80",
    tag: "Slab stack · |Air-drying| · Under cover at the lower barn · 18 months",
    tagEmphasis: "Air-drying",
    alt: "A stack of slabs air-drying under cover at the lower barn.",
  },
];

export function HeroSlideshow() {
  return <UiHeroSlideshow slides={SLIDES} />;
}
