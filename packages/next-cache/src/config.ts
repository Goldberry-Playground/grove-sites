import type { NextConfig } from "next";

/**
 * Next config fragment that loads the shared cache handler. The handler is always
 * configured: it passes straight through to Next's file cache unless `VALKEY_URL` and
 * `GROVE_CACHE_NAMESPACE` are set at runtime, so one prebuilt image serves both modes.
 * `cacheMaxMemorySize` is left unset so env-unset mode keeps Next's default memory cache.
 * Spread the result into an app's `next.config.ts`.
 */
export function groveCacheConfig(): Pick<NextConfig, "cacheHandler"> & {
  cacheHandler: string;
} {
  return { cacheHandler: require.resolve("@grove/next-cache/handler") };
}
