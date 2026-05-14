// At The Grove Nursery — production nursery for trees, shrubs, and
// seasonal plantings. Brand voice: garden-knowledgeable, neighborly,
// season-aware. Brings the "what to plant when" energy without sliding
// into Pinterest-perfect garden-influencer territory.

export const tenantConfig = {
  tenantId: "nursery",
  name: "At The Grove Nursery, LLC",
  domain: "atthegrovenursery.com",
  description:
    "Trees, shrubs, and seasonal plantings — grown in West Virginia, ready for your land",
  copy: {
    shopHeading: "Plant Catalog",
    blogHeading: "In the Beds",
  },
  colors: {
    primary: "#2f5d3a",
    primaryForeground: "#ffffff",
    secondary: "#c4d4a0",
    secondaryForeground: "#1f3a26",
    accent: "#c2604a",
    background: "#f7f4ec",
    foreground: "#1a2e22",
  },
  /** Exact Origin values accepted on state-changing BFF POSTs. Keep in
   *  sync with prod hostnames + the dev port from package.json. */
  allowedOrigins: [
    "https://atthegrovenursery.com",
    "https://www.atthegrovenursery.com",
    "http://localhost:3003",
  ],
} as const;
