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
    "@grove/otel",
  ],
  images: {
    // Frontend performance standard (GOL-864): negotiate AVIF first, then WebP.
    // next/image already transcodes source JPEG/PNG to WebP on demand; adding
    // AVIF gives ~20-30% smaller bytes to browsers that accept it, at no source
    // change. WebP stays as the universal fallback.
    formats: ["image/avif", "image/webp"],
    // Optimized variants are immutable per product-photo revision, so raise the
    // optimizer/CDN cache floor from Next's 60s default to 31 days. Stops the
    // droplet re-transcoding the same photo on every cache miss (see
    // odoo-client/images.ts production note).
    minimumCacheTTL: 2678400,
    remotePatterns: [
      // Level 3 QA Odoo -- product photos on the qa.* storefronts
      {
        protocol: "https",
        hostname: "odoo.qa.gatheringatthegrove.com",
        pathname: "/web/image/**",
      },
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
        hostname: "woodworkingeorge.com",
        pathname: "/web/image/**",
      },
      {
        protocol: "https",
        hostname: "erp.gatheringatthegrove.com",
        pathname: "/web/image/**",
      },
      // Grove assets CDN — future-proofed even though ggg has no public
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
