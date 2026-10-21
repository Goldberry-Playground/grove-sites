import { createOdooClient, OdooApiError } from "@grove/odoo-client";
import type { ListKey, NewsletterProvider, OptInRequest, SubscribeOutcome } from "./types";
import { LIST_KEYS } from "./types";

/** Environment map. Kept node-types-free so this package stays zero-dependency. */
export type EnvMap = Record<string, string | undefined>;

function ambientEnv(): EnvMap {
  return (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {};
}

/**
 * A resolved Odoo newsletter target: the grove_headless REST endpoint plus the
 * bearer key and tenant the opt-in is recorded under.
 */
export interface OdooNewsletterTarget {
  /** Base URL of the tenant's Odoo (e.g. `https://odoo.atthegrovenursery.com`). */
  odooUrl: string;
  /**
   * Tenant slug sent as `X-Grove-Tenant`. Odoo resolves goldberry / nursery /
   * ggg to their website + company; `hub` is not an Odoo website, so it falls
   * through to Host routing and rides the Grove Digest (grove_headless
   * `resolve_newsletter_lists`, FALLBACK_LIST_KEY).
   */
  tenantId: string;
  /** Bearer API key. The endpoint is `auth="bearer"`, so this is required. */
  apiKey: string;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve an {@link OdooNewsletterTarget} from the environment plus the app's
 * tenant slug, or `null` when Odoo isn't wired for this app (no URL or no API
 * key). The env vars (`ODOO_URL`, `ODOO_API_KEY`) are the same ones each
 * storefront's `tenantSecrets` reads for its server-side Odoo client; the hub
 * names its URL `GROVE_ODOO_URL`, accepted as a fallback.
 *
 * Returning `null` rather than throwing lets the route answer an honest 503
 * ("not configured") instead of crashing.
 */
export function resolveOdooNewsletterTarget(
  tenantId: string,
  env: EnvMap = ambientEnv(),
): OdooNewsletterTarget | null {
  const odooUrl = (env.ODOO_URL ?? env.GROVE_ODOO_URL)?.trim();
  const apiKey = env.ODOO_API_KEY?.trim();
  if (!odooUrl || !apiKey || !tenantId) return null;
  return { odooUrl: stripTrailingSlash(odooUrl), tenantId, apiKey };
}

/**
 * Odoo Email Marketing implementation of {@link NewsletterProvider}
 * (grove_headless GOL-3454):
 *
 *   POST {odooUrl}/grove/api/v1/newsletter/subscribe
 *   { email, name?, brand, interests[], source, consent: true, lists[], multibrand, attribution? }
 *   → 200 { partner_id, email, tags[], created, lists[], welcomed }
 *
 * Odoo upserts the `res.partner` (tags for order attribution), then adds an
 * active `mailing.subscription` per key in `lists` and queues ONE welcome
 * email. Re-subscribing within 24h is an idempotent no-op (no duplicate
 * contact, no second welcome). The transport is `@grove/odoo-client`'s
 * `newsletter.subscribe()` so a contract change lands in one place (CLAUDE.md
 * "never raw fetch to backends").
 *
 * This adapter is the never-throw boundary: `OdooApiError` and network
 * failures come back as `{ ok: false, status?, error }` for the route to map
 * to a 502 and alert on.
 */
export function createOdooNewsletterProvider(
  target: OdooNewsletterTarget,
): NewsletterProvider {
  const client = createOdooClient({
    tenantId: target.tenantId,
    odooUrl: target.odooUrl,
    apiKey: target.apiKey,
  });

  return {
    async subscribe(request: OptInRequest, lists: ListKey[]): Promise<SubscribeOutcome> {
      // The per-form label used to be a Ghost member label; keep it as part of
      // the attribution note Odoo writes to the partner's chatter so the CMO
      // can still see which form a signup came from.
      const attribution =
        request.label || request.attribution
          ? { ...(request.attribution ?? {}), ...(request.label ? { form: request.label } : {}) }
          : undefined;
      try {
        const result = await client.newsletter.subscribe({
          email: request.email,
          name: request.name,
          brand: request.brand,
          interests: request.interests ?? [],
          source: request.source,
          // Consent is validated upstream (validateOptIn); the endpoint
          // re-checks it as opt-in proof.
          consent: true,
          lists,
          multibrand: request.multibrand === true,
          attribution,
        });
        return {
          ok: true,
          partnerId: result.partnerId,
          lists: (result.lists ?? []).filter((k): k is ListKey =>
            (LIST_KEYS as readonly string[]).includes(k),
          ),
          welcomed: result.welcomed === true,
        };
      } catch (err) {
        if (err instanceof OdooApiError) {
          const detail = err.body ? ` — ${err.body.slice(0, 300)}` : "";
          return { ok: false, status: err.status, error: `odoo ${err.status}${detail}` };
        }
        return { ok: false, error: `odoo request failed: ${errMsg(err)}` };
      }
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
