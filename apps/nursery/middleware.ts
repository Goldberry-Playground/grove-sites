import { NextResponse, type NextRequest } from "next/server";
import { createOdooClient } from "@grove/odoo-client";
import { tenantConfig } from "./tenant.config";
import { pdpRedirectTarget } from "./lib/pdp-redirect";

/**
 * PDP URL canonicalisation (GOL-3601, GOL-2875 §3 R1/R3/R6).
 *
 * This lives in middleware, not the page, for one reason: the status code. A
 * page can only `permanentRedirect()`, which answers **308**. The spec, and
 * every audit against it, asks for a **301**, and only a middleware response
 * can set that. The page keeps a 308 fallback for the case where this lookup
 * fails (see `app/shop/[slug]/page.tsx`), so the id form never serves 200.
 *
 * Node runtime (stable in Next 15.5) so the Odoo lookup uses the same client
 * and env as the pages. The client is built from `process.env` directly
 * rather than `lib/clients`, because that module imports `server-only` via
 * `tenant.secrets`, which is not meant for the middleware bundle.
 *
 * Cost: one Odoo detail fetch per legacy `/shop/<id>` hit. Slug requests (the
 * links the site itself renders) never call Odoo here.
 */
export const config = {
  matcher: "/shop/:segment",
  runtime: "nodejs",
};

const odoo = createOdooClient({
  tenantId: tenantConfig.tenantId,
  odooUrl: process.env.ODOO_URL ?? "http://localhost:8069",
  apiKey: process.env.ODOO_API_KEY || undefined,
});

async function slugForId(id: number): Promise<string | null> {
  try {
    return (await odoo.products.get(id)).slug ?? null;
  } catch {
    // Unknown id, or Odoo unreachable: fall through to the page. It 404s an
    // unknown id and 308s a known one from its own (mock-backed) lookup.
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const raw = request.nextUrl.pathname.slice("/shop/".length);
  let segment: string;
  try {
    segment = decodeURIComponent(raw);
  } catch {
    return NextResponse.next();
  }

  const target = await pdpRedirectTarget(segment, slugForId);
  if (!target) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/shop/${target}`;
  return NextResponse.redirect(url, 301);
}
