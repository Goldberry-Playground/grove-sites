export const BRANDS = ["goldberry", "ggg", "nursery", "hub"] as const;

export type Brand = (typeof BRANDS)[number];

export function isBrand(value: string): value is Brand {
  return (BRANDS as readonly string[]).includes(value);
}

export const BRAND_LABELS: Record<Brand, string> = {
  goldberry: "Goldberry Grove",
  ggg: "GGG Woodworking",
  nursery: "Grove Nursery",
  hub: "Gather at the Grove",
};
