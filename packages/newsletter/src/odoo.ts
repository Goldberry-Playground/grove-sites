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
 * The call is idempotent by email within the tenant company, so re-subscribing
 * merges tags rather than duplicating the contact. Never throws — a failure is
 * returned as `{ ok: false, error }` so the orchestrator can treat CRM sync as
 * best-effort and never let it block the visitor's opt-in.
 */
export function createOdooCrmSync(
  target: OdooCrmTarget,
  fetchImpl: typeof fetch = fetch,
): NewsletterProvider {
  return {
    async subscribe(request: OptInRequest): Promise<SyncOutcome> {
      const body: Record<string, unknown> = {
        email: request.email,
        brand: request.brand,
        interests: request.interests ?? [],
        source: request.source,
        // Consent is validated upstream; the endpoint re-checks it as opt-in
        // proof and 400s without a truthy value.
        consent: true,
      };
      if (request.name) body.name = request.name;
      if (request.attribution) body.attribution = request.attribution;

      let response: Response;
      try {
        response = await fetchImpl(
          `${target.odooUrl}/grove/api/v1/newsletter/subscribe`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-Grove-Tenant": target.tenantId,
              Authorization: `Bearer ${target.apiKey}`,
            },
            body: JSON.stringify(body),
          },
        );
      } catch (err) {
        return { ok: false, error: `odoo request failed: ${errMsg(err)}` };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          error: `odoo ${response.status} ${response.statusText}${
            text ? ` — ${text.slice(0, 300)}` : ""
          }`,
        };
      }

      const id = await extractPartnerId(response);
      return id ? { ok: true, id } : { ok: true };
    },
  };
}

async function extractPartnerId(
  response: Response,
): Promise<string | undefined> {
  const ctype = response.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) return undefined;
  try {
    const json = (await response.json()) as { partner_id?: string | number };
    return json.partner_id != null ? String(json.partner_id) : undefined;
  } catch {
    return undefined;
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
