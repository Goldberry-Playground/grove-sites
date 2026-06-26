import { HeroSlideshow, type HeroSlide } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

const SLIDES: HeroSlide[] = [
  {
    url: "https://images.unsplash.com/photo-1736506159893-22cca29b8018?w=1800&auto=format&fit=crop&q=80",
    tag: 'Slab № 0418 · |Black walnut| · 11ft × 38" × 2.25" · Air-dried 2yr',
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
];

const frame = {
  height: 420,
  display: "flex",
} as const;

export const Default = () => (
  <div style={frame}>
    <HeroSlideshow slides={SLIDES} />
  </div>
);

export const SingleSlide = () => (
  <div style={frame}>
    <HeroSlideshow slides={[SLIDES[0]]} />
  </div>
);

export const FastCadence = () => (
  <div style={frame}>
    <HeroSlideshow slides={SLIDES} holdMs={1500} fadeMs={500} />
  </div>
);
