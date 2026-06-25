// Gather at the Grove — the village hub.
// Editorial / contemplative voice; Ghost-blog DNA. Neutral parchment palette
// so the three vendor accents (plum/forest/walnut) can pop on cards.

export const tenantConfig = {
  tenantId: "hub",
  name: "Gather at the Grove",
  domain: "gatheringatthegrove.com",
  description:
    "A federated village of independent Appalachian agroforestry makers — Goldberry Grove Farm, GGG Woodworking, and At The Grove Nursery.",
  colors: {
    primary: "#1A1410",        // ink
    primaryForeground: "#F4EFE3", // paper
    secondary: "#F4EFE3",      // paper
    secondaryForeground: "#1A1410",
    accent: "#B1864A",         // amber — warm editorial accent
    background: "#F4EFE3",     // paper
    foreground: "#1A1410",     // ink
    moss: "#2E4530",           // sub-accent for journal/eyebrow
  },
  allowedOrigins: [
    "https://gatheringatthegrove.com",
    "https://www.gatheringatthegrove.com",
    "http://localhost:3000",
  ],
} as const;
