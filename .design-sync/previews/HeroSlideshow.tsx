import { HeroSlideshow, type HeroSlide } from "@grove/ui-kit";
import {
  SAMPLE_HERO_FARM,
  SAMPLE_HERO_NURSERY,
  SAMPLE_PRODUCT_GRAPE,
} from "./_sample-images";

// Authored preview cards (each export = one labeled card). Real JSX, real props.
// Imagery is self-contained (owned, optimized, base64) — no remote/CDN dependency.

const SLIDES: HeroSlide[] = [
  {
    url: SAMPLE_HERO_FARM,
    tag: "The Grove · |40 acres| of regenerative agroforestry · Summersville, WV",
    tagEmphasis: "40 acres",
  },
  {
    url: SAMPLE_HERO_NURSERY,
    tag: "|Pollinator season| · native bees working the orchard rows",
    tagEmphasis: "Pollinator season",
  },
  {
    url: SAMPLE_PRODUCT_GRAPE,
    tag: "|Concord grapes| · trellis-grown · ready late September",
    tagEmphasis: "Concord grapes",
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
