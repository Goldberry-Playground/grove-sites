// George George George Woodworking — handcrafted hardwood furniture and
// custom millwork. Brand voice: workshop-forward, precise, materially
// curious. Avoid words like "rustic" and "artisan" — too generic for the
// craft tier this brand sits at.

export const tenantConfig = {
  tenantId: "ggg",
  name: "George George George Woodworking, LLC",
  domain: "woodworkingeorge.com",
  description: "Handcrafted hardwood furniture and custom millwork from West Virginia",
  copy: {
    shopHeading: "The Workshop",
    blogHeading: "Notes from the Bench",
  },
  colors: {
    primary: "#3f2a1d",
    primaryForeground: "#ffffff",
    secondary: "#d4c4a8",
    secondaryForeground: "#2a1d12",
    accent: "#a0522d",
    background: "#faf6f0",
    foreground: "#1f1611",
  },
  /** Exact Origin values accepted on state-changing BFF POSTs. Keep in
   *  sync with prod hostnames + the dev port from package.json. */
  allowedOrigins: [
    "https://woodworkingeorge.com",
    "https://www.woodworkingeorge.com",
    "http://localhost:3002",
  ],
} as const;
