import { createOdooClient, OdooApiError } from "@grove/odoo-client";
import type { NewsletterProvider, OptInRequest, SyncOutcome } from "./types";
import type { EnvMap } from "./config";

/**
 * A resolved Odoo CRM sync target: the grove_headless REST endpoint plus the
 * bearer key and tenant the opt-in should be recorded under.
 */
export interface OdooCrmTarget {
  /** Base URL of the tenant's Odoo (e.g. `https://odoo.atthegrovenursery.com`). */
  odooUrl: string;
  /** Tenant slug sent as `X-Grove-Tenant` — routes to the Odoo company. */
  tenantId: string;
  /** Bearer API key. The endpoint is `auth="bearer"`, so this is required. */
  apiKey: string;
}

function ambientEnv(): EnvMap {
  return (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {};
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Resolve an {@link OdooCrmTarget} from the environment plus the caller's tenant
 * slug, or `null` when Odoo isn't wired for this app (no URL or no API key). The
 * subscribe route passes `tenantConfig.tenantId`; the env vars (`ODOO_URL`,
 * `ODOO_API_KEY`) are the same ones each app's `tenantSecrets` reads for its
 * server-side Odoo client, so CRM sync uses the identical credentials.
 *
 * Returning `null` (rather than throwing) keeps the CRM sync a best-effort
 * side-write: an app that hasn't provisioned an Odoo key still captures opt-ins
 * to Ghost, it just reports the CRM leg as `skipped`.
 */
export function resolveOdooCrmConfig(
  tenantId: string,
  env: EnvMap = ambientEnv(),
): OdooCrmTarget | null {
  const odooUrl = env.ODOO_URL?.trim();
  const apiKey = env.ODOO_API_KEY?.trim();
  if (!odooUrl || !apiKey || !tenantId) return null;
  return { odooUrl: stripTrailingSlash(odooUrl), tenantId, apiKey };
}

/**
 * Odoo CRM implementation of {@link NewsletterProvider}. Upserts the opt-in as a
 * `res.partner` in the tenant company and tags it (`newsletter`, `brand:<x>`,
 * `interest:<x>`, `source:<x>`) via grove_headless (GOL-221):
 *
 *   POST {odooUrl}/grove/api/v1/newsletter/subscribe
 *   { email, name?, brand, interests[], source, consent: true, attribution? }
 *   → 200 { partner_id, email, tags[], created }
 *
 * The transport is delegated to `@grove/odoo-client`'s `newsletter.subscribe()`
 * — the same client every storefront uses for products/cart/orders — so a
 * contract change (header rename, key rotation, error envelope) lands in one
 * place instead of silently missing this hand-rolled leg (GOL-1319, CLAUDE.md
 * "never raw fetch to backends").
 *
 * The call is idempotent by email within the tenant company, so re-subscribing
 * merges tags rather than duplicating the contact. This adapter is the
 * never-throw boundary: `newsletter.subscribe()` throws `OdooApiError` on a
 * non-2xx and rejects on a network error, both of which are caught here and
 * returned as `{ ok: false, error }` so the orchestrator can treat CRM sync as
 * best-effort and never let it block the visitor's opt-in.
 */
export function createOdooCrmSync(
  target: OdooCrmTarget,
): NewsletterProvider {
  const client = createOdooClient({
    tenantId: target.tenantId,
    odooUrl: target.odooUrl,
    apiKey: target.apiKey,
  });

  return {
    async subscribe(request: OptInRequest): Promise<SyncOutcome> {
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
          attribution: request.attribution,
        });
        return result.partnerId
          ? { ok: true, id: result.partnerId }
          : { ok: true };
      } catch (err) {
        if (err instanceof OdooApiError) {
          const detail = err.body ? ` — ${err.body.slice(0, 300)}` : "";
          return { ok: false, error: `odoo ${err.status}${detail}` };
        }
        return { ok: false, error: `odoo request failed: ${errMsg(err)}` };
      }
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
