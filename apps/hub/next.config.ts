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
    // TS source packages consumed by the /api/assets/* ingest endpoints (GOL-290).
    "@grove/assets",
    "@grove/brand",
  ],
  // Native `sharp` + the AWS SDK (pulled in by @grove/assets' optimize recipe)
  // must stay external to the server bundle rather than be traced/bundled, so
  // the native binary resolves at runtime on the Node server.
  serverExternalPackages: ["sharp", "@aws-sdk/client-s3"],
  images: {
    // Frontend performance standard (GOL-864): negotiate AVIF first, then WebP.
    // next/image already transcodes source JPEG/PNG to WebP on demand; adding
    // AVIF gives ~20-30% smaller bytes to browsers that accept it, at no source
    // change. WebP stays as the universal fallback.
    formats: ["image/avif", "image/webp"],
    // Optimized variants are immutable per asset revision, so raise the
    // optimizer/CDN cache floor from Next's 60s default to 31 days.
    minimumCacheTTL: 2678400,
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
