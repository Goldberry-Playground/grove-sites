/**
 * @grove/newsletter — shared newsletter opt-in capture for the Grove brands.
 *
 * Odoo Email Marketing (`mass_mailing`, grove_headless GOL-3454) is the list of
 * record for every Grove newsletter; Ghost is blog-only (Josh, "option C",
 * 2026-10-19). A signup is a single opt-in: the storefront BFF posts the
 * address to `POST /grove/api/v1/newsletter/subscribe`, Odoo adds it to the
 * chosen `mailing.list`s on submit and sends one welcome email with a one-click
 * unsubscribe. Nobody has to click a confirmation link.
 *
 * Three lists back the four brands:
 *
 *   nursery → Nursery News   (At The Grove Nursery)
 *   farm    → Farm News      (Goldberry Grove)
 *   digest  → Grove Digest   (the hub; GGG rides the Digest)
 *
 * Every form carries one unticked "Also send me news from the other Grove
 * brands" checkbox (`multibrand`). Ticked, the submit subscribes to every list
 * the primary brand is not — the storefront expands that into the explicit
 * `lists` array Odoo validates (spec §2).
 */

/** A brand a visitor can opt in to. `ggg` rides the Digest. */
export type Brand = "grove" | "nursery" | "goldberry" | "ggg";

/** Odoo `mailing.list` keys, as seeded by grove_headless `data/mailing_lists.xml`. */
export type ListKey = "nursery" | "farm" | "digest";

/** Every seeded list, in the order Odoo reports them. */
export const LIST_KEYS: readonly ListKey[] = ["nursery", "farm", "digest"];

/** The list a brand's own form subscribes to first (spec §1, §2). */
export const PRIMARY_LIST: Record<Brand, ListKey> = {
  grove: "digest",
  nursery: "nursery",
  goldberry: "farm",
  ggg: "digest",
};

/** Where the opt-in was captured; becomes a `source:<x>` contact tag in Odoo. */
export type OptInSource =
  | "newsletter-signup"
  | "checkout"
  | "notify-me"
  | "footer"
  | "import";

/** A single opt-in event, normalized across every capture surface. */
export interface OptInRequest {
  email: string;
  /** Optional display name for the `res.partner`. */
  name?: string;
  /**
   * Brand whose site the form is on. PINNED SERVER-SIDE by the app's route
   * (never trusted from the request body), so a nursery form can only ever
   * subscribe someone to the nursery list as its primary.
   */
  brand: Brand;
  /** Free-form interest slugs, applied as `interest:<x>` contact tags. */
  interests?: string[];
  /** Where this opt-in happened. */
  source: OptInSource;
  /**
   * Explicit consent flag. Opt-in must be affirmative — a request with
   * `consent !== true` is rejected before any Odoo call.
   */
  consent: boolean;
  /**
   * The "Also send me news from the other Grove brands" checkbox. Unticked by
   * default; true adds every other list (spec §2). Never implied.
   */
  multibrand?: boolean;
  /**
   * Per-form segmentation handle (`nursery-footer`, `treefacts-content`).
   * Recorded in the Odoo attribution note so the CMO can still slice signups
   * by form after the Ghost labels went away.
   */
  label?: string;
  /** Marketing attribution captured at signup (utm_*, referrer, etc.). */
  attribution?: Record<string, string>;
}

/** Result of the Odoo subscribe write. */
export interface SubscribeOutcome {
  ok: boolean;
  /** `res.partner` id when Odoo returns one. */
  partnerId?: string;
  /** Lists the address is now subscribed to, as Odoo confirmed them. */
  lists?: ListKey[];
  /** True when Odoo queued the welcome email on this submit. */
  welcomed?: boolean;
  /** Human-readable failure reason when `ok` is false. */
  error?: string;
  /** Upstream HTTP status when the failure came from Odoo. */
  status?: number;
  /** True when Odoo isn't configured for this app and no call was made. */
  skipped?: boolean;
}

/**
 * Newsletter provider seam. Production binds the Odoo adapter; tests bind a
 * fake. `lists` is already resolved (see `listsFor`), so a provider only
 * transports it.
 */
export interface NewsletterProvider {
  subscribe(request: OptInRequest, lists: ListKey[]): Promise<SubscribeOutcome>;
}
