import type { Brand, Interest, Sender } from "./types";
import { BRAND_TO_SENDER } from "./types";

/**
 * Resolved MailerLite configuration. Absent env → `null`, and every capture
 * surface degrades to a "not configured" response rather than crashing. This
 * lets the feature merge and deploy before CMO finishes provisioning the
 * MailerLite account + sender identities (GOL-214 task 1).
 */
export interface MailerLiteConfig {
  apiKey: string;
  /** Base URL of the MailerLite v2 API. Overridable for tests. */
  baseUrl: string;
  /**
   * MailerLite group ids keyed by tag. Keys are `brand:<brand>` and
   * `interest:<interest>`. A subscriber is added to the union of the groups
   * that match their brand + interests — this is how the single audience gets
   * the brand/interest tags called for in §6.4.
   */
  groups: Record<string, string>;
  /**
   * When true, subscribers are created as `unconfirmed` so MailerLite sends its
   * double opt-in confirmation. Defaults to true — affirmative + confirmed
   * consent is the safe default for a cold list.
   */
  doubleOptIn: boolean;
}

const DEFAULT_BASE_URL = "https://connect.mailerlite.com/api";

/** Environment map. Kept node-types-free so this package stays zero-dependency. */
export type EnvMap = Record<string, string | undefined>;

function ambientEnv(): EnvMap {
  return (
    (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {}
  );
}

/**
 * Read newsletter config from the environment. Returns `null` when the API key
 * is absent (feature not yet provisioned).
 *
 * Env:
 *   MAILERLITE_API_KEY        — required; feature is off without it.
 *   MAILERLITE_GROUPS         — JSON map, e.g.
 *                               {"brand:grove":"123","interest:produce":"456"}
 *   MAILERLITE_BASE_URL       — optional override (default MailerLite v2 API).
 *   NEWSLETTER_DOUBLE_OPTIN   — "0" to disable double opt-in (default on).
 */
export function resolveMailerLiteConfig(
  env: EnvMap = ambientEnv(),
): MailerLiteConfig | null {
  const apiKey = env.MAILERLITE_API_KEY?.trim();
  if (!apiKey) return null;

  let groups: Record<string, string> = {};
  const raw = env.MAILERLITE_GROUPS?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string" && v.trim()) groups[k] = v.trim();
        }
      }
    } catch {
      // Malformed map → treat as no groups rather than crashing the route.
      // The subscribe still succeeds; it just lands untagged (visible in
      // MailerLite) instead of dropping the visitor's opt-in.
      groups = {};
    }
  }

  return {
    apiKey,
    baseUrl: env.MAILERLITE_BASE_URL?.trim() || DEFAULT_BASE_URL,
    groups,
    doubleOptIn: env.NEWSLETTER_DOUBLE_OPTIN?.trim() !== "0",
  };
}

/** Tag key for a brand's group. */
export function brandGroupKey(brand: Brand): string {
  const sender: Sender = BRAND_TO_SENDER[brand];
  return `brand:${sender}`;
}

/** Tag key for an interest's group. */
export function interestGroupKey(interest: Interest): string {
  return `interest:${interest}`;
}

/**
 * Resolve the MailerLite group ids a request should land in: the brand group
 * plus one per interest. Unmapped tags are silently skipped (the subscriber is
 * still created; the missing group just means CMO hasn't wired that tag yet).
 */
export function resolveGroupIds(
  config: MailerLiteConfig,
  brand: Brand,
  interests: Interest[] = [],
): string[] {
  const keys = [brandGroupKey(brand), ...interests.map(interestGroupKey)];
  const ids = keys
    .map((k) => config.groups[k])
    .filter((id): id is string => Boolean(id));
  // De-dupe: brand + interest could theoretically map to the same group.
  return [...new Set(ids)];
}
