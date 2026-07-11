export type {
  Brand,
  Sender,
  Interest,
  OptInSource,
  OptInRequest,
  OptInResult,
  SyncOutcome,
  NewsletterProvider,
} from "./types";
export { BRAND_TO_SENDER, HUB_SENDER } from "./types";

export type { GhostInstance, GhostNewsletterConfig, EnvMap } from "./config";
export {
  resolveGhostConfig,
  resolveBrandInstance,
  resolveHubInstance,
  labelsFor,
} from "./config";

export { createGhostNewsletterProvider } from "./ghost";
export {
  captureOptIn,
  validateOptIn,
  ghostCaptureDeps,
  OptInValidationError,
  type CaptureDeps,
} from "./capture";
