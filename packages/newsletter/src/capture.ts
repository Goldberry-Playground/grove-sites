import type {
  CrmSync,
  NewsletterProvider,
  OptInRequest,
  OptInResult,
} from "./types";

export class OptInValidationError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = "OptInValidationError";
  }
}

// Pragmatic email check — rejects obvious garbage without pretending to be a
// full RFC 5322 parser (MailerLite does the authoritative validation).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate + normalize a raw opt-in payload from any capture surface. Throws
 * {@link OptInValidationError} on bad input so the API route can return 400.
 */
export function validateOptIn(input: OptInRequest): OptInRequest {
  const email = input.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw new OptInValidationError("A valid email is required.", "email");
  }
  if (input.consent !== true) {
    throw new OptInValidationError(
      "Opt-in requires affirmative consent.",
      "consent",
    );
  }
  if (!input.brand) {
    throw new OptInValidationError("A brand is required.", "brand");
  }
  return {
    ...input,
    email,
    name: input.name?.trim() || undefined,
    interests: input.interests ?? [],
  };
}

export interface CaptureDeps {
  /** Newsletter provider, or null when MailerLite isn't provisioned yet. */
  provider: NewsletterProvider | null;
  /** Odoo CRM sync, or null to skip attribution. */
  crm?: CrmSync | null;
}

/**
 * Capture an opt-in: subscribe to the newsletter (the thing the visitor asked
 * for) and best-effort record it in Odoo CRM for attribution.
 *
 * Contract:
 *   - Newsletter is primary. Its failure fails the whole capture (`ok: false`).
 *   - CRM is best-effort. Its failure is reported but never blocks the opt-in —
 *     losing attribution must not cost us a subscriber.
 *   - When the provider is null (not provisioned), the newsletter outcome is
 *     `skipped` and `ok` is false, so the route can return 503 cleanly.
 *
 * Input is assumed already validated via {@link validateOptIn}.
 */
export async function captureOptIn(
  request: OptInRequest,
  deps: CaptureDeps,
): Promise<OptInResult> {
  const newsletter = deps.provider
    ? await deps.provider.subscribe(request)
    : { ok: false, skipped: true, error: "newsletter not configured" };

  const crm = deps.crm
    ? await deps.crm.record(request)
    : { ok: false, skipped: true, error: "crm sync not configured" };

  return { ok: newsletter.ok, newsletter, crm };
}
