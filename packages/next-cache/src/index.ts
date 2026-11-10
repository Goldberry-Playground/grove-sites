/**
 * Shared-cache building blocks for app code (for example the catalog warmer). Next loads
 * the cache handler itself from the bundled `@grove/next-cache/handler` (`dist/handler.js`).
 */
export {
  BreakerOpenError,
  type CacheStore,
  createValkeyStore,
  StoreNotReadyError,
  withBreaker,
} from "./store";
export { DEFAULT_TTL_SECONDS, maxAgeSeconds, PRODUCT_MAX_AGE_SECONDS } from "./policy";
