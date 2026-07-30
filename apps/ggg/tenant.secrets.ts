import "server-only";

// Backend-only secrets for the GGG (George George George Woodworking) tenant.
// Importing this module from a `"use client"` file is a build-time error
// thanks to `server-only`, so these values cannot leak into the browser
// bundle.

/**
 * Read a required env var. In production runtime, an empty/missing value
 * throws at module-load so the app fails closed rather than silently making
 * unauthenticated backend calls. In development, test, and the Next.js
 * build phase, falls back to the provided default — the build phase
 * doesn't make backend calls, and prod env values are injected at deploy
 * time (Docker run / Kubernetes Pod), not at build time.
 *
 * NEXT_PHASE is set by Next.js to "phase-production-build" during
 * `next build`. Without this guard, `next build` would always fail in CI
 * because no API keys are present in the build env (and shouldn't be).
 */
function requireEnv(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !isBuild) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Refusing to start to avoid unauthenticated backend calls.`,
    );
  }
  return devDefault;
}

export const tenantSecrets = {
  odooUrl: requireEnv("ODOO_URL", "http://localhost:8069"),
  odooApiKey: requireEnv("ODOO_API_KEY", ""),
  ghostUrl: requireEnv("GHOST_URL", "http://localhost:2369"),
  ghostContentKey: requireEnv("GHOST_CONTENT_KEY", ""),
  // Guides publish webhook (GOL-985/986). Read WITHOUT requireEnv: the
  // secret is provisioned by DevOps and may be absent until then. An empty
  // value makes the receiver fail closed (401 on every delivery) rather
  // than crash the app at boot.
  grovePublishWebhookSecret: process.env.GROVE_PUBLISH_WEBHOOK_SECRET ?? "",
} as const;
