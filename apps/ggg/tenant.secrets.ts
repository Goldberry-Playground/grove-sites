import "server-only";

// Backend-only secrets for the GGG (George George George Woodworking) tenant.
// Importing this module from a `"use client"` file is a build-time error
// thanks to `server-only`, so these values cannot leak into the browser
// bundle.

/**
 * Read a required env var. In production, an empty/missing value throws at
 * module-load so the app fails closed rather than silently making
 * unauthenticated backend calls. In development and test, falls back to the
 * provided default so local dev still works without a full secrets stack.
 */
function requireEnv(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
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
} as const;
