// George George George Woodworking — handcrafted hardwood furniture and
// custom millwork. Brand voice: workshop-forward, precise, materially
// curious. Avoid words like "rustic" and "artisan" — too generic for the
// craft tier this brand sits at.

export const tenantConfig = {
  tenantId: "ggg",
  // Customer-facing brand name — used for the browser <title> and header
  // wordmark. Keep the legal ", LLC" out of these surfaces; it belongs only
  // in the footer legal line (see `legalName`). — GOL-868 (GOL-867 F4)
  name: "George George George Woodworking",
  // Registered legal entity — footer copyright / legal line only.
  legalName: "George George George Woodworking, LLC",
  domain: "woodworkingeorge.com",
  description: "Handcrafted hardwood furniture and custom millwork from West Virginia",
  copy: {
    shopHeading: "The Workshop",
    blogHeading: "Notes from the Bench",
  },
  colors: {
    // Wireframe palette — walnut × cherry × amber × bone.
    primary: "#3A2418",            // walnut
    primaryForeground: "#EFE6D3",  // bone
    secondary: "#7A2E1A",          // cherry
    secondaryForeground: "#EFE6D3",
    accent: "#B17839",             // amber
    background: "#EFE6D3",         // bone
    foreground: "#1F1611",         // deep walnut
  },
  /** Exact Origin values accepted on state-changing BFF POSTs. Keep in
   *  sync with prod hostnames + the QA host + the dev port from package.json. */
  allowedOrigins: [
    "https://woodworkingeorge.com",
    "https://www.woodworkingeorge.com",
    "https://ggg.qa.gatheringatthegrove.com",
    "http://localhost:3002",
  ],
} as const;
