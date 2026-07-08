import { SiblingStrip } from "@grove/ui-kit";

// Authored preview cards (each export = one labeled card). Real JSX, real props.

const SITES = [
  { name: "Gather at the Grove", href: "https://gatheringatthegrove.com" },
  { name: "Goldberry Grove", href: "https://goldberrygrove.farm" },
  { name: "George Woodworking", href: "https://woodworkingeorge.com" },
  { name: "At the Grove Nursery", href: "https://atthegrovenursery.com" },
];

export const OnGoldberry = () => (
  <SiblingStrip currentSiteName="Goldberry Grove" sites={SITES} />
);

export const OnHub = () => (
  <SiblingStrip currentSiteName="Gather at the Grove" sites={SITES} />
);

export const OnNursery = () => (
  <SiblingStrip currentSiteName="At the Grove Nursery" sites={SITES} />
);
