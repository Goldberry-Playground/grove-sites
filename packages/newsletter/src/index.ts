export type {
  Brand,
  Sender,
  Interest,
  OptInSource,
  OptInRequest,
  OptInResult,
  SyncOutcome,
  NewsletterProvider,
  CrmSync,
} from "./types";
export { BRAND_TO_SENDER } from "./types";

export type { MailerLiteConfig } from "./config";
export {
  resolveMailerLiteConfig,
  resolveGroupIds,
  brandGroupKey,
  interestGroupKey,
} from "./config";

export { createMailerLiteProvider } from "./mailerlite";
export { createOdooCrmSync, type OdooCrmConfig } from "./odoo-crm";
export {
  captureOptIn,
  validateOptIn,
  OptInValidationError,
  type CaptureDeps,
} from "./capture";
