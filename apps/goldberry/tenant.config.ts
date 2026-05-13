// Goldberry Grove Farm — orchard + farm-stand + heritage breeds.
// Brand voice: warm, earnest, proud-of-craft. Avoid "fresh" / "local" cliches.

export const tenantConfig = {
  tenantId: "goldberry",
  name: "Goldberry Grove Farm",
  domain: "goldberrygrove.farm",
  description: "Farm-fresh produce and artisan goods from Goldberry Grove",
  copy: {
    shopHeading: "Farm Shop",
    blogHeading: "From the Grove",
  },
  colors: {
    primary: "#b45309",
    primaryForeground: "#ffffff",
    secondary: "#fde68a",
    secondaryForeground: "#78350f",
    accent: "#f59e0b",
    background: "#fffbeb",
    foreground: "#451a03",
  },
  /** Exact Origin values accepted on state-changing BFF POSTs. Keep in
   *  sync with prod hostnames + the dev port from package.json. */
  allowedOrigins: [
    "https://goldberrygrove.farm",
    "https://www.goldberrygrove.farm",
    "http://localhost:3001",
  ],
} as const;
