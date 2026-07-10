/**
 * @grove/newsletter — shared opt-in capture for the Grove brand family.
 *
 * Implements §6.4 of the approved email/domain plan (GOL-205 / GOL-214):
 * one shared platform (MailerLite), a single audience, and per-brand +
 * per-interest tags. Three active senders live on `mail.<domain>`:
 *
 *   - grove     → The Grove Digest        (mail.gatheringatthegrove.com)
 *   - nursery   → Nursery planting-season (mail.atthegrovenursery.com)
 *   - goldberry → Goldberry from the farm (mail.goldberrygrove.farm)
 *
 * GGG has no dedicated newsletter yet — its opt-ins ride the Digest, so the
 * `ggg` brand maps onto the `grove` sender/tag (see BRAND_TO_SENDER).
 */

/** A brand a visitor can opt in to. `ggg` is deferred and rides the Digest. */
export type Brand = "grove" | "nursery" | "goldberry" | "ggg";

/** The three active sender identities. `ggg` collapses onto `grove`. */
export type Sender = "grove" | "nursery" | "goldberry";

/**
 * Interest tags applied on top of the brand tag. Free-form by design — the set
 * grows as the marketplace does — but these are the ones wired at launch.
 */
export type Interest =
  | "produce"
  | "nursery"
  | "woodworking"
  | "events"
  | "farm-updates";

/** Where the opt-in was captured, for attribution. */
export type OptInSource =
  | "newsletter-signup"
  | "checkout"
  | "notify-me"
  | "footer"
  | "import";

/** A single opt-in event, normalized across every capture surface. */
export interface OptInRequest {
  email: string;
  /** Optional display name. */
  name?: string;
  /** Brand the visitor opted into. Drives the sender identity + brand tag. */
  brand: Brand;
  /** Additional interest tags. */
  interests?: Interest[];
  /** Where this opt-in happened. */
  source: OptInSource;
  /**
   * Explicit consent flag. Opt-in must be affirmative — a request with
   * `consent !== true` is rejected before any provider call.
   */
  consent: boolean;
  /** Marketing attribution captured at signup (utm_*, referrer, etc.). */
  attribution?: Record<string, string>;
}

/** Result of a single downstream call (MailerLite or Odoo). */
export interface SyncOutcome {
  ok: boolean;
  /** Provider/subsystem-specific id when available (e.g. subscriber id). */
  id?: string;
  /** Human-readable failure reason when `ok` is false. */
  error?: string;
  /** True when the subsystem is not configured and the call was skipped. */
  skipped?: boolean;
}

/** Aggregate result returned to the API route. */
export interface OptInResult {
  /**
   * Overall success from the visitor's perspective: true when the newsletter
   * subscription (the thing they asked for) succeeded. CRM sync is best-effort
   * attribution and never blocks the visitor's opt-in.
   */
  ok: boolean;
  /** Newsletter provider (MailerLite) outcome. */
  newsletter: SyncOutcome;
  /** Odoo CRM attribution outcome. */
  crm: SyncOutcome;
}

/**
 * Newsletter provider seam. MailerLite is the only implementation today, but
 * the app only ever depends on this interface so the platform can be swapped
 * without touching capture surfaces.
 */
export interface NewsletterProvider {
  /**
   * Upsert a subscriber into the single audience, applying the brand + interest
   * tags. Idempotent by email — re-subscribing updates tags, never duplicates.
   */
  subscribe(request: OptInRequest): Promise<SyncOutcome>;
}

/** CRM attribution seam (Odoo grove_headless). */
export interface CrmSync {
  /** Record the opt-in against a CRM contact/lead for order attribution. */
  record(request: OptInRequest): Promise<SyncOutcome>;
}

/** `ggg` newsletter is deferred — it rides the Grove Digest. */
export const BRAND_TO_SENDER: Record<Brand, Sender> = {
  grove: "grove",
  nursery: "nursery",
  goldberry: "goldberry",
  ggg: "grove",
};
