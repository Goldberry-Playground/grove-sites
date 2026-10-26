// Server-only entry for @grove/analytics.
//
// The package root (`./index.ts`) is a "use client" module, so its exports
// become client references when imported from a Server Component and can't be
// called on the server. The analytics config must be resolved on the server,
// per request, from the container's runtime env (see config.ts for why), so the
// resolver is re-exported here behind a non-client path: a root layout imports
// `resolveAnalyticsConfig` from "@grove/analytics/server".
export { resolveAnalyticsConfig } from "./config";
export type { AnalyticsConfig } from "./types";
