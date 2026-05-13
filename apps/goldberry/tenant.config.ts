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
  odooUrl: process.env.ODOO_URL ?? "http://localhost:8069",
  odooApiKey: process.env.ODOO_API_KEY ?? "",
  ghostUrl: process.env.GHOST_URL ?? "http://localhost:2368",
  ghostContentKey: process.env.GHOST_CONTENT_KEY ?? "",
} as const;
