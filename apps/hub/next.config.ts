import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker / DO App Platform deploys.
  // .next/standalone/ contains node_modules + a server.js that boots Next
  // with no need for the source tree at runtime.
  output: "standalone",
  // Tell Next that the workspace root is two directories up so the standalone
  // tracer pulls in @grove/* package files from the monorepo.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@grove/ui",
    "@grove/analytics",
    "@grove/config",
    "@grove/otel",
    "@grove/ghost-client",
    "@grove/odoo-client",
  ],
  images: {
    remotePatterns: [
      // Grove assets CDN — future-proofed even though hub has no public
      // assets today. Cloudflare vanity host is canonical; raw DO CDN
      // hostname is kept for direct fetches during migration probing.
      {
        protocol: "https",
        hostname: "assets.gatheringatthegrove.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "grove-assets.nyc3.cdn.digitaloceanspaces.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
