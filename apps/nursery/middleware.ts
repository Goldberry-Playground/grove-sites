import { NextResponse, type NextRequest } from "next/server";
import { createOdooClient } from "@grove/odoo-client";
import { tenantConfig } from "./tenant.config";
import { pdpRedirectTarget } from "./lib/pdp-redirect";
import { TESTER_COOKIE, testerCookie, testerDecision } from "./lib/planner-tester";

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
  matcher: ["/shop/:segment", "/plan"],
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

/**
 * `/plan?tester=<token>` (planner winter-beta spec §B.6 / §C.4, GOL-3551):
 * ask Odoo whether the token is active, keep it in an HttpOnly cookie when
 * it is, and redirect to the same plan without the token so it does not sit
 * in the address bar, the history or a shared link. A token Odoo refuses
 * clears the cookie; Odoo off or unreachable leaves the cookie as it was.
 */
async function testerLink(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("tester") ?? "";
  const decision = await testerDecision(odoo, token);
  const url = request.nextUrl.clone();
  url.searchParams.delete("tester");
  const response = NextResponse.redirect(url, 303);
  response.headers.set("cache-control", "no-store");
  if (decision === "set") {
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    response.cookies.set(testerCookie(token, proto === "https"));
  } else if (decision === "clear") {
    response.cookies.delete(TESTER_COOKIE);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/plan") {
    return request.nextUrl.searchParams.has("tester") ? testerLink(request) : NextResponse.next();
  }
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
