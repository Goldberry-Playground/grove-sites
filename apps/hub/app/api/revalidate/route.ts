import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { marketplace } from "../../../data/marketplace";

/**
 * Webhook target for Odoo (product writes) and Ghost (post publish/update).
 *
 * Body schema (POST JSON):
 *   { kind: "product", vendor: "<slug>", productSlug: "<slug>", productId?: number }
 *   { kind: "post", postSlug: "<slug>" }
 *
 * Shared-secret auth: x-grove-revalidate-secret header must match
 * env GROVE_REVALIDATE_SECRET. Each vendor configures the secret in their
 * Odoo webhook setup.
 */
export async function POST(req: Request) {
  const provided = req.headers.get("x-grove-revalidate-secret");
  const expected = process.env.GROVE_REVALIDATE_SECRET ?? "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const kind = payload.kind;

  if (kind === "product") {
    const vendor = String(payload.vendor ?? "");
    const productSlug = String(payload.productSlug ?? "");
    if (!vendor || !productSlug) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (!marketplace.vendors.some((v) => v.slug === vendor)) {
      return NextResponse.json({ error: "unknown_vendor" }, { status: 404 });
    }
    revalidatePath(`/marketplace/${vendor}/${productSlug}`);
    revalidatePath(`/marketplace/vendor/${vendor}`);
    revalidatePath("/marketplace");
    revalidatePath("/");
    return NextResponse.json({ ok: true, revalidated: [
      `/marketplace/${vendor}/${productSlug}`,
      `/marketplace/vendor/${vendor}`,
      "/marketplace",
      "/",
    ]});
  }

  if (kind === "post") {
    const postSlug = String(payload.postSlug ?? "");
    if (!postSlug) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    revalidatePath(`/journal/${postSlug}`);
    revalidatePath("/journal");
    revalidatePath("/");
    return NextResponse.json({ ok: true, revalidated: [
      `/journal/${postSlug}`,
      "/journal",
      "/",
    ]});
  }

  return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
}
