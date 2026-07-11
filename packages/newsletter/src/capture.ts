import type {
  NewsletterProvider,
  OptInRequest,
  OptInResult,
  SyncOutcome,
} from "./types";
import {
  resolveBrandInstance,
  resolveHubInstance,
  type GhostNewsletterConfig,
} from "./config";
import { createGhostNewsletterProvider } from "./ghost";

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
// full RFC 5322 parser (Ghost does the authoritative validation).
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
    hubOptIn: input.hubOptIn === true,
    label: input.label?.trim() || undefined,
  };
}

export interface CaptureDeps {
  /**
   * Provider for the brand's own Ghost instance (the list of record), or null
   * when that instance isn't configured yet.
   */
  brand: NewsletterProvider | null;
  /**
   * Provider for the hub (`grove`) instance. Only used on explicit
   * `hubOptIn`. Null when the hub isn't configured or the brand already *is*
   * the hub (grove/ggg).
   */
  hub?: NewsletterProvider | null;
}

const NOT_CONFIGURED: SyncOutcome = {
  ok: false,
  skipped: true,
  error: "newsletter not configured",
};

/**
 * Capture an opt-in: write the member to the brand's Ghost instance (the thing
 * the visitor asked for) and, on explicit hub opt-in, dual-write to the hub.
 *
 * Contract:
 *   - The brand write is primary. Its failure fails the whole capture
 *     (`ok: false`).
 *   - The hub dual-write is best-effort and only attempted when the visitor
 *     explicitly opted in (`hubOptIn`) AND a hub provider is present. Its
 *     failure is reported but never blocks the primary opt-in — losing the
 *     cross-subscribe must not cost us the subscriber.
 *   - When the brand provider is null (not provisioned), the brand outcome is
 *     `skipped` and `ok` is false, so the route can return 503 cleanly.
 *
 * Input is assumed already validated via {@link validateOptIn}.
 */
export async function captureOptIn(
  request: OptInRequest,
  deps: CaptureDeps,
): Promise<OptInResult> {
  const brand = deps.brand
    ? await deps.brand.subscribe(request)
    : NOT_CONFIGURED;

  let hub: SyncOutcome = { ok: false, skipped: true };
  if (request.hubOptIn && deps.hub) {
    hub = await deps.hub.subscribe(request);
  }

  return { ok: brand.ok, brand, hub };
}

/**
 * Build {@link CaptureDeps} from resolved Ghost config for a given brand: a
 * provider for the brand's list-of-record instance, and — when the brand isn't
 * itself the hub — a provider for the hub instance for dual-write. The route
 * only needs to call this once and pass the result to {@link captureOptIn}.
 */
export function ghostCaptureDeps(
  config: GhostNewsletterConfig,
  brand: OptInRequest["brand"],
  fetchImpl: typeof fetch = fetch,
): CaptureDeps {
  const brandTarget = resolveBrandInstance(config, brand);
  const hubInstance = resolveHubInstance(config, brand);
  return {
    brand: brandTarget
      ? createGhostNewsletterProvider(brandTarget.instance, fetchImpl)
      : null,
    hub: hubInstance
      ? createGhostNewsletterProvider(hubInstance, fetchImpl)
      : null,
  };
}
