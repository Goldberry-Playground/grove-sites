import { NextResponse } from "next/server";
import {
  captureOptIn,
  validateOptIn,
  resolveGhostConfig,
  ghostCaptureDeps,
  OptInValidationError,
  type Brand,
  type Interest,
  type OptInSource,
} from "@grove/newsletter";

/**
 * Newsletter opt-in capture — Ghost-native (GOL-245 / GOL-249).
 *
 * POST /api/newsletter/subscribe
 * { email, name?, brand, interests?, source?, label?, hubOptIn?, consent, attribution? }
 *
 * Server-only BFF. Each brand's own Ghost instance is that brand's list of
 * record; on explicit `hubOptIn` the member is dual-written to the hub (grove)
 * instance too. Env-gated — until the Ghost instance map is provisioned
 * (GHOST_NEWSLETTER_INSTANCES, or a bare GHOST_URL for the hub), this returns
 * 503 rather than crashing, so the route can ship ahead of provisioning.
 */
export const dynamic = "force-dynamic";

// The hub captures for the Grove Digest audience; `ggg` rides the Digest.
const HUB_BRAND: Brand = "grove";

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
      brand: (payload.brand as Brand) ?? HUB_BRAND,
      interests: (payload.interests as Interest[]) ?? [],
      source: (payload.source as OptInSource) ?? "newsletter-signup",
      label: payload.label ? String(payload.label) : undefined,
      hubOptIn: payload.hubOptIn === true,
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

  const config = resolveGhostConfig();
  if (!config) {
    // Feature merged but not yet provisioned. Surface clearly, don't 500.
    return NextResponse.json(
      { error: "newsletter_not_configured" },
      { status: 503 },
    );
  }

  const deps = ghostCaptureDeps(config, request.brand);
  if (!deps.brand) {
    // The config exists but this brand's instance isn't wired.
    return NextResponse.json(
      { error: "newsletter_not_configured", brand: request.brand },
      { status: 503 },
    );
  }

  const result = await captureOptIn(request, deps);

  if (!result.ok) {
    return NextResponse.json(
      { error: "subscribe_failed", detail: result.brand.error },
      { status: 502 },
    );
  }

  // The hub dual-write is best-effort — a 200 means the visitor is subscribed to
  // the brand's list of record. `hubSynced` lets the client/monitoring see the
  // cross-subscribe health; null when they didn't opt into the hub.
  return NextResponse.json({
    ok: true,
    subscriberId: result.brand.id ?? null,
    hubSynced: result.hub.skipped ? null : result.hub.ok,
  });
}
