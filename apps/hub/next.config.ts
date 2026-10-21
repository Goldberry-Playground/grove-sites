import type { NextConfig } from "next";
import path from "node:path";

// GOL-3477: marketplace card photos are Odoo `/web/image/...` files served
// through next/image. The hub reads products from whatever GROVE_ODOO_URL
// points at (marketplace.ts), so derive the optimizer allowlist from that SAME
// variable (it is RUN_AND_BUILD_TIME on QA and prod app specs) — the host we
// actually request from can never be rejected. Same shape as the nursery's
// ODOO_URL-derived entry (GOL-1874).
function odooImageAllowlist(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const raw = process.env.GROVE_ODOO_URL;
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
    // Next 16 rejects any `quality` not listed here. 75 is next/image's
    // default; 82 is the product-photo re-encode quality (GOL-818, used by the
    // hub's NextImageAdapter for marketplace cards — GOL-3477).
    qualities: [75, 82],
    // Optimized variants are immutable per asset revision, so raise the
    // optimizer/CDN cache floor from Next's 60s default to 31 days.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      // Vendor Odoo product photos (GOL-3477): env-derived first, then the
      // prod + QA hosts as explicit literals so a build without
      // GROVE_ODOO_URL in its environment still allows the launched sites,
      // plus the local dev default from data/marketplace.ts.
      ...odooImageAllowlist(),
      {
        protocol: "https",
        hostname: "odoo.gatheringatthegrove.com",
        pathname: "/web/image/**",
      },
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
  // /links is the short link-in-bio URL printed in social bios; the canonical,
  // indexable page is /alliance. Permanent (308) so search engines consolidate
  // on /alliance; the query string (?utm_source=…) passes through untouched.
  async redirects() {
    return [{ source: "/links", destination: "/alliance", permanent: true }];
  },
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
