// At The Grove Nursery — production nursery for trees, shrubs, and
// seasonal plantings. Brand voice: garden-knowledgeable, neighborly,
// season-aware. Brings the "what to plant when" energy without sliding
// into Pinterest-perfect garden-influencer territory.

export const tenantConfig = {
  tenantId: "nursery",
  // Customer-facing brand name — used for the browser <title> and header
  // wordmark. Keep the legal ", LLC" out of these surfaces; it belongs only
  // in the footer legal line (see `legalName`). — GOL-868 (GOL-867 F4)
  name: "At The Grove Nursery",
  // Registered legal entity — footer copyright / legal line only.
  legalName: "At The Grove Nursery, LLC",
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
   *  sync with prod hostnames + the QA host + the dev port from package.json. */
  allowedOrigins: [
    "https://atthegrovenursery.com",
    "https://www.atthegrovenursery.com",
    "https://nursery.qa.gatheringatthegrove.com",
    "http://localhost:3003",
  ],
} as const;
