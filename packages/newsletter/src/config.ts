import type { Brand, Interest, OptInRequest, Sender } from "./types";
import { BRAND_TO_SENDER, HUB_SENDER } from "./types";

/**
 * A single Ghost instance the newsletter can write members into.
 */
export interface GhostInstance {
  /**
   * Base URL of the Ghost instance (e.g. `https://blog.goldberrygrove.farm`).
   * Members are POSTed to `${url}/members/api/send-magic-link/`.
   */
  url: string;
  /**
   * Optional explicit newsletter ids to subscribe the member to on this
   * instance. Omit to let Ghost apply the instance's default newsletter(s).
   */
  newsletters?: string[];
}

/**
 * Resolved Ghost newsletter configuration. Absent env → `null`, and every
 * capture surface degrades to a "not configured" response rather than crashing.
 * This lets the feature ship before the Ghost member endpoints / transactional
 * SMTP are fully wired.
 */
export interface GhostNewsletterConfig {
  /**
   * Ghost instances keyed by sender. `grove` is the hub (Gathering at the
   * Grove); `nursery` and `goldberry` are the tenant instances. A brand resolves
   * to its instance via BRAND_TO_SENDER (so `ggg` → `grove`).
   */
  instances: Partial<Record<Sender, GhostInstance>>;
}

/** Environment map. Kept node-types-free so this package stays zero-dependency. */
export type EnvMap = Record<string, string | undefined>;

function ambientEnv(): EnvMap {
  return (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {};
}

const SENDERS: Sender[] = ["grove", "nursery", "goldberry"];

/**
 * Read newsletter config from the environment. Returns `null` when no Ghost
 * instance is configured (feature not yet provisioned).
 *
 * Primary env:
 *   GHOST_NEWSLETTER_INSTANCES — JSON map of sender → instance, e.g.
 *     {"grove":{"url":"https://blog.gatheringatthegrove.com"},
 *      "nursery":{"url":"https://blog.atthegrovenursery.com"},
 *      "goldberry":{"url":"https://blog.goldberrygrove.farm"}}
 *
 * Convenience fallback (single-tenant apps that already set GHOST_URL for their
 * own instance): if the JSON map is absent, a lone `GHOST_URL` is read as the
 * `grove` (hub) instance so the hub app keeps working without the map. Tenant
 * apps that need dual-write should set the JSON map.
 */
export function resolveGhostConfig(
  env: EnvMap = ambientEnv(),
): GhostNewsletterConfig | null {
  const instances: Partial<Record<Sender, GhostInstance>> = {};

  const raw = env.GHOST_NEWSLETTER_INSTANCES?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const sender of SENDERS) {
          const entry = (parsed as Record<string, unknown>)[sender];
          const inst = normalizeInstance(entry);
          if (inst) instances[sender] = inst;
        }
      }
    } catch {
      // Malformed map → fall through to the GHOST_URL fallback rather than
      // crashing the route. A misconfigured map should fail loud in review,
      // not take down signup at runtime.
    }
  }

  // Single-instance fallback: treat a bare GHOST_URL as the hub instance.
  if (Object.keys(instances).length === 0) {
    const hubUrl = env.GHOST_URL?.trim();
    if (hubUrl) instances[HUB_SENDER] = { url: stripTrailingSlash(hubUrl) };
  }

  if (Object.keys(instances).length === 0) return null;
  return { instances };
}

function normalizeInstance(entry: unknown): GhostInstance | null {
  if (!entry || typeof entry !== "object") return null;
  const url = (entry as { url?: unknown }).url;
  if (typeof url !== "string" || !url.trim()) return null;
  const out: GhostInstance = { url: stripTrailingSlash(url.trim()) };
  const nl = (entry as { newsletters?: unknown }).newsletters;
  if (Array.isArray(nl)) {
    const ids = nl.filter((n): n is string => typeof n === "string" && !!n.trim());
    if (ids.length) out.newsletters = ids;
  }
  return out;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** The Ghost instance (and its sender key) that is the list of record for a brand. */
export function resolveBrandInstance(
  config: GhostNewsletterConfig,
  brand: Brand,
): { sender: Sender; instance: GhostInstance } | null {
  const sender = BRAND_TO_SENDER[brand];
  const instance = config.instances[sender];
  return instance ? { sender, instance } : null;
}

/**
 * The hub instance to dual-write into, or `null` when the hub is not configured
 * or the brand already *is* the hub (grove/ggg) — in which case a second write
 * would be redundant.
 */
export function resolveHubInstance(
  config: GhostNewsletterConfig,
  brand: Brand,
): GhostInstance | null {
  if (BRAND_TO_SENDER[brand] === HUB_SENDER) return null;
  return config.instances[HUB_SENDER] ?? null;
}

/**
 * The Ghost labels to apply to a member at signup: the per-form label (or a
 * `<brand>-<source>` fallback) plus one `interest-<name>` label per interest.
 * De-duped and stable-ordered. These are what the CMO segments audiences by.
 */
export function labelsFor(request: OptInRequest): string[] {
  const formLabel =
    request.label?.trim() || `${request.brand}-${request.source}`;
  const interestLabels = (request.interests ?? []).map(
    (i: Interest) => `interest-${i}`,
  );
  return [...new Set([formLabel, ...interestLabels])];
}
