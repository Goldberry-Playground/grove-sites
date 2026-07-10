import type { CrmSync, OptInRequest, SyncOutcome } from "./types";

/**
 * Config for the Odoo CRM attribution sync. Mirrors the odoo-client tenant
 * shape so it can be constructed from the same vendor/tenant record.
 */
export interface OdooCrmConfig {
  /** Base URL of the tenant's Odoo instance (grove_headless). */
  odooUrl: string;
  /** Tenant slug, sent as X-Grove-Tenant. */
  tenantId: string;
  /** Bearer token for the write endpoint (opt-in creates a CRM record). */
  apiKey?: string;
}

/** grove_headless response contract for the newsletter opt-in endpoint. */
interface OdooCrmResponse {
  partner_id?: number;
  lead_id?: number;
}

/**
 * Records a newsletter opt-in against Odoo CRM for order attribution.
 *
 * Calls the grove_headless endpoint:
 *
 *   POST {odooUrl}/grove/api/v1/newsletter/subscribe
 *   { email, name, brand, interests, source, consent, attribution }
 *
 * grove_headless upserts a mailing.contact / res.partner and tags it with the
 * brand + interests so downstream orders can be attributed. That endpoint is
 * tracked separately (see GOL-214 follow-up on the odoocker side); until it
 * ships this call 404s, which is treated as a best-effort miss — the visitor's
 * newsletter subscription still succeeds.
 */
export function createOdooCrmSync(
  config: OdooCrmConfig,
  fetchImpl: typeof fetch = fetch,
): CrmSync {
  return {
    async record(request: OptInRequest): Promise<SyncOutcome> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Grove-Tenant": config.tenantId,
      };
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

      let response: Response;
      try {
        response = await fetchImpl(
          `${config.odooUrl}/grove/api/v1/newsletter/subscribe`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              email: request.email,
              name: request.name ?? null,
              brand: request.brand,
              interests: request.interests ?? [],
              source: request.source,
              consent: request.consent,
              attribution: request.attribution ?? {},
            }),
          },
        );
      } catch (err) {
        return { ok: false, error: `odoo crm request failed: ${errMsg(err)}` };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          error: `odoo crm ${response.status} ${response.statusText}${
            text ? ` — ${text.slice(0, 300)}` : ""
          }`,
        };
      }

      const json = (await response
        .json()
        .catch(() => ({}))) as OdooCrmResponse;
      const id = json.partner_id ?? json.lead_id;
      return { ok: true, id: id != null ? String(id) : undefined };
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
