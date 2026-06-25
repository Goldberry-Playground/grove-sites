// Goldberry Grove Farm — orchard + farm-stand + heritage breeds.
// Brand voice: warm, earnest, proud-of-craft. Avoid "fresh" / "local" cliches.
//
// Palette + typography per Goldberry Grove Brand Guideline (Feb 2026).
// Brand colors: Ivory Mist · Midnight Bark · Harvest Gold · Forest Command ·
// Chestnut Reserve. Plum retained as a single accent (per project owner —
// the only color outside the brand-guide spec we keep using).

export const tenantConfig = {
  tenantId: "goldberry",
  name: "Goldberry Grove Farm",
  domain: "goldberrygrove.farm",
  description:
    "A tree nursery and agrotourism orchard rooted in the shared history of the chestnut — Appalachian land, Korean heritage.",
  copy: {
    shopHeading: "Farm Shop",
    blogHeading: "From the Grove",
  },
  colors: {
    // Brand-guide palette.
    primary: "#7F4F1D",            // Chestnut Reserve (brand-guide typo
                                   // listed #617333, but the swatch + every
                                   // page background is this chestnut brown)
    primaryForeground: "#FFF7E6",  // Ivory Mist on primary
    secondary: "#EDD682",          // Harvest Gold
    secondaryForeground: "#7F4F1D",
    accent: "#617333",             // Forest Command
    background: "#FFF7E6",         // Ivory Mist
    foreground: "#3D2810",         // deep chestnut, body text
    tan: "#CCA75C",                // Midnight Bark
    plum: "#5A2A4B",               // retained accent outside the brand guide
  },
  /** Exact Origin values accepted on state-changing BFF POSTs. Keep in
   *  sync with prod hostnames + the dev port from package.json. */
  allowedOrigins: [
    "https://goldberrygrove.farm",
    "https://www.goldberrygrove.farm",
    "http://localhost:3001",
  ],
} as const;
