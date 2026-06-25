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
    // Wireframe palette — forest × orange × leaf × parchment.
    primary: "#1F3F2B",            // forest
    primaryForeground: "#F2EBD9",  // parchment
    secondary: "#8AAB6E",          // leaf
    secondaryForeground: "#1F3F2B",
    accent: "#D5641A",             // orange
    background: "#F2EBD9",         // parchment
    foreground: "#1A2A1F",         // deep forest
  },
  /** Exact Origin values accepted on state-changing BFF POSTs. Keep in
   *  sync with prod hostnames + the dev port from package.json. */
  allowedOrigins: [
    "https://atthegrovenursery.com",
    "https://www.atthegrovenursery.com",
    "http://localhost:3003",
  ],
} as const;
