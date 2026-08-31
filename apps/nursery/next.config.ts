import type { NextConfig } from "next";
import path from "node:path";

// Product images are fetched from whatever host ODOO_URL points at — every
// shop page resolves them with resolveOdooImageUrl(..., process.env.ODOO_URL).
// Derive the next/image allowlist entry from that SAME variable so the host
// we actually request from can never be rejected by the optimizer. A
// hardcoded list that drifted from ODOO_URL (prod's host was simply never
// added) is exactly what broke every prod product photo (GOL-1874).
function odooImageAllowlist(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const raw = process.env.ODOO_URL;
  if (!raw) return [];
  try {
    const u = new URL(raw);
    return [
      {
        protocol: u.protocol === "http:" ? "http" : "https",
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
        pathname: "/web/image/**",
      },
    ];
  } catch {
    return [];
  }
}

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
      // Derived from ODOO_URL at build time — always allows the host the
      // storefront is actually configured to fetch product images from
      // (localhost / QA / prod, whichever this build targets). GOL-1874.
      ...odooImageAllowlist(),
      // Production Odoo -- product photos on the launched storefronts. Kept as
      // an explicit literal (not only env-derived) so the build allows prod
      // even if ODOO_URL is not present in the image-build environment.
      {
        protocol: "https",
        hostname: "odoo.gatheringatthegrove.com",
        pathname: "/web/image/**",
      },
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
        hostname: "atthegrovenursery.com",
        pathname: "/web/image/**",
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
  // GOL-885 / GOL-873: stop Accept-blind AVIF cache poisoning at the
  // DigitalOcean App Platform (Cloudflare-backed) edge. The image optimizer
  // negotiates format by `Accept` and sends `Vary: Accept`, but DO's shared
  // edge ignores `Vary` and caches the first-negotiated variant (often AVIF)
  // for every client for up to `minimumCacheTTL` (31d), so non-AVIF browsers
  // (e.g. Safari < 16.4) get an undecodable image. DO exposes no edge-cache
  // toggle, so the only lever is the origin response header.
  // `CDN-Cache-Control: no-store` forbids SHARED-cache storage while the
  // optimizer's own `Cache-Control: public, max-age=<ttl>` still lets the
  // browser cache privately for 31d, and Next's on-disk cache
  // (`x-nextjs-cache`) keeps origin transcode cost low.
  // Verified live (Next 15.5.21): a config `Cache-Control` is clobbered by the
  // optimizer, but `CDN-Cache-Control` — a key the optimizer never sets —
  // lands cleanly on every `/_next/image` response.
  async headers() {
    return [
      {
        source: "/_next/image",
        headers: [{ key: "CDN-Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
