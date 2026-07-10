import { NextResponse } from "next/server";
import {
  captureOptIn,
  validateOptIn,
  resolveMailerLiteConfig,
  createMailerLiteProvider,
  createOdooCrmSync,
  OptInValidationError,
  type Brand,
  type Interest,
  type OptInSource,
} from "@grove/newsletter";

/**
 * Newsletter opt-in capture (§6.4 of the email/domain plan, GOL-214).
 *
 * POST /api/newsletter/subscribe
 * { email, name?, brand, interests?, source?, consent, attribution? }
 *
 * Server-only BFF: the MailerLite key and Odoo write token never reach the
 * browser. Env-gated — until CMO provisions the MailerLite account
 * (MAILERLITE_API_KEY), this returns 503 rather than crashing, so the route can
 * ship ahead of provisioning.
 */
export const dynamic = "force-dynamic";

const ODOO_API_URL = process.env.GROVE_ODOO_URL ?? "http://localhost:8069";

// The hub captures for the Grove Digest audience; `ggg` rides the Digest.
const HUB_TENANT = "goldberry";

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let request;
  try {
    request = validateOptIn({
      email: String(payload.email ?? ""),
      name: payload.name ? String(payload.name) : undefined,
      brand: (payload.brand as Brand) ?? "grove",
      interests: (payload.interests as Interest[]) ?? [],
      source: (payload.source as OptInSource) ?? "newsletter-signup",
      consent: payload.consent === true,
      attribution:
        payload.attribution && typeof payload.attribution === "object"
          ? (payload.attribution as Record<string, string>)
          : undefined,
    });
  } catch (err) {
    if (err instanceof OptInValidationError) {
      return NextResponse.json(
        { error: "validation_error", field: err.field, message: err.message },
        { status: 400 },
      );
    }
    throw err;
  }

  const mlConfig = resolveMailerLiteConfig();
  if (!mlConfig) {
    // Feature merged but not yet provisioned. Surface clearly, don't 500.
    return NextResponse.json(
      { error: "newsletter_not_configured" },
      { status: 503 },
    );
  }

  const provider = createMailerLiteProvider(mlConfig);
  const crm = createOdooCrmSync({
    odooUrl: ODOO_API_URL,
    tenantId: HUB_TENANT,
    apiKey: process.env.GROVE_ODOO_API_KEY,
  });

  const result = await captureOptIn(request, { provider, crm });

  if (!result.ok) {
    return NextResponse.json(
      { error: "subscribe_failed", detail: result.newsletter.error },
      { status: 502 },
    );
  }

  // CRM attribution is best-effort — report it, but a 200 means the visitor is
  // subscribed. `crmSynced` lets the client/monitoring see attribution health.
  return NextResponse.json({
    ok: true,
    subscriberId: result.newsletter.id ?? null,
    crmSynced: result.crm.ok,
  });
}
