import type {
  Brand,
  ListKey,
  NewsletterProvider,
  OptInRequest,
  SubscribeOutcome,
} from "./types";
import { LIST_KEYS, PRIMARY_LIST } from "./types";

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
// full RFC 5322 parser (Odoo normalizes and re-validates the address).
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
  if (!input.brand || !(input.brand in PRIMARY_LIST)) {
    throw new OptInValidationError("A brand is required.", "brand");
  }
  return {
    ...input,
    email,
    name: input.name?.trim() || undefined,
    interests: (input.interests ?? []).filter(
      (i): i is string => typeof i === "string" && i.trim().length > 0,
    ),
    multibrand: input.multibrand === true,
    label: input.label?.trim() || undefined,
  };
}

/**
 * The ordered list keys a submit subscribes to (spec §2, Josh 2026-10-20):
 * the brand's own list always, then — only when the "other Grove brands" box
 * is ticked — every seeded list the primary is not. Primary first, each key at
 * most once, never empty. The storefront owns this expansion so the ticked box
 * means "every other brand", not just the Digest.
 */
export function listsFor(brand: Brand, multibrand = false): ListKey[] {
  const primary = PRIMARY_LIST[brand];
  if (!multibrand) return [primary];
  return [primary, ...LIST_KEYS.filter((key) => key !== primary)];
}

const NOT_CONFIGURED: SubscribeOutcome = {
  ok: false,
  skipped: true,
  error: "newsletter not configured",
};

/**
 * Capture an opt-in: one write to Odoo, the list of record. There is no second
 * destination any more — the Ghost member write and the hub dual-write are
 * gone (GOL-3456). When the provider is null (Odoo not wired for the app) the
 * outcome is `skipped` and `ok` is false, so the route can return 503 cleanly.
 *
 * Input is assumed already validated via {@link validateOptIn}.
 */
export async function captureOptIn(
  request: OptInRequest,
  provider: NewsletterProvider | null,
): Promise<SubscribeOutcome> {
  if (!provider) return NOT_CONFIGURED;
  return provider.subscribe(request, listsFor(request.brand, request.multibrand));
}
