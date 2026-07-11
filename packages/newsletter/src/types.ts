/**
 * @grove/newsletter — shared opt-in capture for the Grove brand family.
 *
 * Implements the GOL-245 decision (Ghost-native, drop MailerLite): each brand's
 * own Ghost instance is that brand's **list of record**. Signups POST a Ghost
 * member (the `data-members-email` / send-magic-link pattern), so Ghost owns
 * confirmation (double opt-in via magic link), the member database, and
 * segmentation labels — no external ESP audience, no CSV export/import.
 *
 * Three sender instances back the brands:
 *
 *   - grove     → Gathering at the Grove (the hub) — the Grove Digest
 *   - nursery   → At the Grove Nursery
 *   - goldberry → Goldberry Grove (the farm)
 *
 * GGG has no dedicated newsletter yet — its opt-ins ride the hub Digest, so the
 * `ggg` brand maps onto the `grove` sender/instance (see BRAND_TO_SENDER).
 *
 * Dual-write: a signup form may offer an explicit "Also get news from Gathering
 * at the Grove" checkbox. When checked (`hubOptIn`), the opt-in is written to
 * BOTH the brand instance and the hub (`grove`) instance. Two Ghost member
 * databases, two confirmations, one explicit consent.
 */

/** A brand a visitor can opt in to. `ggg` is deferred and rides the Digest. */
export type Brand = "grove" | "nursery" | "goldberry" | "ggg";

/** The three Ghost instances that back newsletters. `ggg` collapses onto `grove`. */
export type Sender = "grove" | "nursery" | "goldberry";

/**
 * Interest tags applied on top of the brand, materialized as Ghost labels.
 * Free-form by design — the set grows as the marketplace does — but these are
 * the ones wired at launch.
 */
export type Interest =
  | "produce"
  | "nursery"
  | "woodworking"
  | "events"
  | "farm-updates";

/** Where the opt-in was captured, for the per-form segmentation label. */
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
  /** Brand the visitor opted into. Drives which Ghost instance is the list of record. */
  brand: Brand;
  /** Additional interest tags, applied as Ghost labels. */
  interests?: Interest[];
  /** Where this opt-in happened. */
  source: OptInSource;
  /**
   * Explicit consent flag. Opt-in must be affirmative — a request with
   * `consent !== true` is rejected before any Ghost call.
   */
  consent: boolean;
  /**
   * Explicit hub opt-in — the "Also get news from Gathering at the Grove"
   * checkbox. When true, the opt-in is dual-written to the hub (`grove`)
   * instance in addition to the brand instance. Requires its own affirmative
   * check on the form; never implied.
   */
  hubOptIn?: boolean;
  /**
   * Per-form segmentation label applied to the Ghost member at signup (e.g.
   * `nursery-footer`, `checkout`, `notify-me-oak`). This is the segmentation
   * handle the CMO slices audiences by. Falls back to `<brand>-<source>` when
   * absent (see labelsFor).
   */
  label?: string;
  /** Marketing attribution captured at signup (utm_*, referrer, etc.). */
  attribution?: Record<string, string>;
}

/** Result of a single Ghost member write. */
export interface SyncOutcome {
  ok: boolean;
  /** Ghost member id when the instance returns one (send-magic-link often doesn't). */
  id?: string;
  /** Human-readable failure reason when `ok` is false. */
  error?: string;
  /** True when the target instance is not configured / not applicable and the call was skipped. */
  skipped?: boolean;
}

/** Aggregate result returned to the API route. */
export interface OptInResult {
  /**
   * Overall success from the visitor's perspective: true when the write to the
   * brand's own Ghost instance (the list of record — the thing they asked for)
   * succeeded. The hub dual-write is best-effort and never blocks the opt-in.
   */
  ok: boolean;
  /** Write to the brand's own Ghost instance (the list of record). */
  brand: SyncOutcome;
  /**
   * Optional dual-write to the hub (`grove`) instance. `skipped` when the
   * visitor didn't opt into the hub, or when the brand instance *is* the hub
   * (grove/ggg) so a second write would be redundant.
   */
  hub: SyncOutcome;
}

/**
 * Newsletter provider seam. A provider is bound to a single Ghost instance;
 * the capture orchestrator holds one for the brand and (optionally) one for the
 * hub. The app only ever depends on this interface.
 */
export interface NewsletterProvider {
  /**
   * Create/confirm a Ghost member on this instance, applying the segmentation
   * labels. Idempotent by email — re-subscribing an existing address re-sends
   * the magic link and merges labels rather than duplicating the member.
   */
  subscribe(request: OptInRequest): Promise<SyncOutcome>;
}

/** The hub instance every brand can cross-subscribe into. */
export const HUB_SENDER: Sender = "grove";

/** `ggg` newsletter is deferred — it rides the Grove Digest (hub instance). */
export const BRAND_TO_SENDER: Record<Brand, Sender> = {
  grove: "grove",
  nursery: "nursery",
  goldberry: "goldberry",
  ggg: "grove",
};
