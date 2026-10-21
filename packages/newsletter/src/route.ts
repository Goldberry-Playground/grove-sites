import type { Brand, OptInSource } from "./types";
import { captureOptIn, validateOptIn, OptInValidationError } from "./capture";
import {
  createOdooNewsletterProvider,
  resolveOdooNewsletterTarget,
  type EnvMap,
} from "./odoo";
import { reportCaptureFailure } from "./alert";

/**
 * Shared `POST /api/newsletter/subscribe` handler for every Grove storefront
 * (GOL-3456). Each app mounts it with its own brand and tenant pinned:
 *
 *   export const { POST } = createNewsletterSubscribeRoute({
 *     brand: "nursery", tenantId: tenantConfig.tenantId,
 *     allowedOrigins: tenantConfig.allowedOrigins,
 *   });
 *
 * Body (what the shared `CaptureForm` POSTs):
 *   { email, name?, interests?, source?, label?, multibrand?, consent, attribution? }
 *
 * The brand is NOT read from the body. A visitor on the nursery site can only
 * be subscribed to Nursery News as their primary; the only cross-brand path is
 * the explicit `multibrand` checkbox, which the route expands into the `lists`
 * array Odoo validates (spec §2).
 *
 * Responses:
 *   200 { ok: true, lists, welcomed, subscriberId }
 *   400 { error: "invalid_json" | "validation_error", field?, message? }
 *   403 { error: "origin_not_allowed" }
 *   502 { error: "subscribe_failed" }         Odoo rejected or unreachable
 *   503 { error: "newsletter_not_configured" } no ODOO_URL / ODOO_API_KEY
 *
 * Every 5xx also fires {@link reportCaptureFailure} so an outage pages an
 * operator instead of hiding behind the form's "try again" copy.
 */
export interface NewsletterRouteOptions {
  brand: Brand;
  /** `X-Grove-Tenant` slug for the Odoo call (`hub` rides the Digest). */
  tenantId: string;
  /**
   * Exact-match `Origin` allowlist. When given, a POST without a matching
   * Origin is refused with 403 — the same gate the lead/restock routes use, so
   * a script cannot subscribe strangers from off-site. Omit to skip the gate.
   */
  allowedOrigins?: readonly string[];
  /** Env seam (defaults to `process.env`). */
  env?: EnvMap;
  /** Fetch seam for the alert webhook. */
  fetchImpl?: typeof fetch;
}

const SOURCES: readonly OptInSource[] = [
  "newsletter-signup",
  "checkout",
  "notify-me",
  "footer",
  "import",
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function ambientEnv(): EnvMap {
  return (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {};
}

export function createNewsletterSubscribeRoute({
  brand,
  tenantId,
  allowedOrigins,
  env,
  fetchImpl,
}: NewsletterRouteOptions) {
  const routePath = "/api/newsletter/subscribe";

  async function POST(req: Request): Promise<Response> {
    if (allowedOrigins) {
      const origin = req.headers.get("origin");
      if (!origin || !allowedOrigins.includes(origin)) {
        return json({ error: "origin_not_allowed" }, 403);
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ error: "invalid_json" }, 400);
    }

    const rawSource = typeof payload.source === "string" ? payload.source : "";
    const source: OptInSource = (SOURCES as readonly string[]).includes(rawSource)
      ? (rawSource as OptInSource)
      : "newsletter-signup";

    let request;
    try {
      request = validateOptIn({
        email: String(payload.email ?? ""),
        name: payload.name ? String(payload.name).slice(0, 200) : undefined,
        brand,
        interests: Array.isArray(payload.interests)
          ? payload.interests.filter((i): i is string => typeof i === "string").slice(0, 20)
          : [],
        source,
        label: payload.label ? String(payload.label).slice(0, 100) : undefined,
        multibrand: payload.multibrand === true,
        consent: payload.consent === true,
        attribution:
          payload.attribution && typeof payload.attribution === "object"
            ? (payload.attribution as Record<string, string>)
            : undefined,
      });
    } catch (err) {
      if (err instanceof OptInValidationError) {
        return json(
          { error: "validation_error", field: err.field, message: err.message },
          400,
        );
      }
      throw err;
    }

    const resolvedEnv = env ?? ambientEnv();
    const target = resolveOdooNewsletterTarget(tenantId, resolvedEnv);
    if (!target) {
      // Merged but not provisioned for this app. Surface clearly, don't 500,
      // and page an operator: a storefront with no list of record is an outage.
      await reportCaptureFailure(
        { app: tenantId, route: routePath, status: 503, detail: "ODOO_URL / ODOO_API_KEY not set" },
        { env: resolvedEnv, fetchImpl },
      );
      return json({ error: "newsletter_not_configured" }, 503);
    }

    const outcome = await captureOptIn(request, createOdooNewsletterProvider(target));
    if (!outcome.ok) {
      await reportCaptureFailure(
        { app: tenantId, route: routePath, status: 502, detail: outcome.error },
        { env: resolvedEnv, fetchImpl },
      );
      return json({ error: "subscribe_failed" }, 502);
    }

    return json({
      ok: true,
      lists: outcome.lists ?? [],
      welcomed: outcome.welcomed === true,
      subscriberId: outcome.partnerId ?? null,
    });
  }

  return { POST };
}
