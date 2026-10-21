export type {
  Brand,
  ListKey,
  OptInSource,
  OptInRequest,
  SubscribeOutcome,
  NewsletterProvider,
} from "./types";
export { LIST_KEYS, PRIMARY_LIST } from "./types";

export {
  captureOptIn,
  validateOptIn,
  listsFor,
  OptInValidationError,
} from "./capture";

export {
  createOdooNewsletterProvider,
  resolveOdooNewsletterTarget,
  type OdooNewsletterTarget,
  type EnvMap,
} from "./odoo";

export {
  reportCaptureFailure,
  resetCaptureAlertThrottle,
  CAPTURE_ALERT_THROTTLE_MS,
  type CaptureFailure,
  type CaptureAlertOptions,
} from "./alert";

export {
  createNewsletterSubscribeRoute,
  type NewsletterRouteOptions,
} from "./route";
