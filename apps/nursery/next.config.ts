import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker deploys.
  // .next/standalone/ contains node_modules + a server.js that boots Next
  // with no need for the source tree at runtime.
  output: "standalone",
  // Tell Next that the workspace root is two directories up so the standalone
  // tracer pulls in @grove/* package files from the monorepo.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@grove/ui",
    "@grove/checkout",
    "@grove/odoo-client",
    "@grove/ghost-client",
    "@grove/analytics",
    "@grove/config",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8069",
        pathname: "/web/image/**",
      },
      // Inside Docker the Odoo URL is reached via host.docker.internal.
      {
        protocol: "http",
        hostname: "host.docker.internal",
        port: "8069",
        pathname: "/web/image/**",
      },
      {
        protocol: "https",
        hostname: "atthegrovenursery.com",
        pathname: "/web/image/**",
      },
      {
        protocol: "https",
        hostname: "erp.gatheringatthegrove.com",
        pathname: "/web/image/**",
      },
      // Demo / placeholder catalog images while Odoo is still being set up.
      // Remove this entry once the mock-products module is deleted.
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      // Grove assets CDN — hero images, brand imagery, backgrounds.
      // Cloudflare-fronted vanity host is the canonical URL; the raw DO CDN
      // hostname is here for direct fetches during migration probing.
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
