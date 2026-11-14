import { OdooApiError, type OdooClient } from "@grove/odoo-client";
import { RULE_KEYS } from "@grove/planner";
import { overLimit } from "./planner-learning";

/**
 * Tester mode for the planner (winter-beta spec §B.6 / §C.4, GOL-3551).
 *
 * Tester mode is a flag, not a login. Josh hands about ten people a link,
 * `/plan?tester=<token>`; middleware asks Odoo whether the token is active,
 * stores it in an HttpOnly cookie for 90 days and redirects to the same plan
 * without the token in the address bar. The page renders the tester bench
 * only when that cookie is present, and the two tester routes below read the
 * token from the cookie (never from the page's JS, which cannot see it) and
 * pass it to Odoo, which names the tester and 403s anything else.
 */

export const TESTER_COOKIE = "grove_planner_tester";
export const TESTER_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
/** Odoo mints `secrets.token_urlsafe(24)` (32 chars); allow some slack, nothing exotic. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_NOTE = 2000;
const MAX_BODY_BYTES = 8 * 1024;

export const TESTER_FACTS = [
  "zone_min",
  "zone_max",
  "years_to_fruit",
  "tolerates_wet",
  "tolerates_poor_soil",
  "tolerates_shade",
  "pollination",
  "harvest_months",
  "role",
  "succession",
  "stratum",
] as const;
export type TesterFact = (typeof TESTER_FACTS)[number];

export function isTesterToken(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/** The cookie the middleware sets: HttpOnly, Lax, site-wide, 90 days. */
export function testerCookie(token: string, secure: boolean) {
  return {
    name: TESTER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: TESTER_COOKIE_MAX_AGE,
  };
}

/** Read the tester token from a request's Cookie header; null when absent or malformed. */
export function testerTokenFrom(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== TESTER_COOKIE) continue;
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
    return isTesterToken(value) ? value : null;
  }
  return null;
}

/**
 * What `/plan?tester=<token>` does with the token: "set" the cookie (Odoo
 * knows it), "clear" it (Odoo says no), or "keep" whatever is there (Odoo
 * is off or unreachable, so this request proves nothing either way).
 */
export async function testerDecision(
  odoo: Pick<OdooClient, "planner">,
  token: string,
): Promise<"set" | "clear" | "keep"> {
  if (!isTesterToken(token)) return "clear";
  try {
    const status = await odoo.planner.testerStatus(token);
    return status === "valid" ? "set" : status === "invalid" ? "clear" : "keep";
  } catch {
    return "keep";
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

export type TesterKind = "dispute" | "propose";

/** Shape-check a dispute or propose body; Odoo validates strictly again. */
export function cleanTesterBody(kind: TesterKind, raw: Record<string, unknown>): Record<string, unknown> | null {
  if (kind === "propose") {
    const key = raw.key;
    const value = raw.value;
    if (typeof key !== "string" || !(RULE_KEYS as readonly string[]).includes(key)) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return { key, value };
  }
  const id = raw.product_tmpl_id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const fact = raw.fact;
  if (typeof fact !== "string" || !(TESTER_FACTS as readonly string[]).includes(fact)) return null;
  const zone = raw.zone;
  if (zone != null && (typeof zone !== "number" || !Number.isInteger(zone))) return null;
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, MAX_NOTE) : null;
  return { product_tmpl_id: id, fact, note, zone: zone ?? null, contradicts: true };
}

export interface TesterRouteOptions {
  allowedOrigins?: readonly string[];
  now?: () => number;
  store?: Map<string, number[]>;
}

/**
 * `POST /api/planner/{dispute,propose}`: Origin gate, the tester cookie
 * (403 without one, before anything reaches Odoo), a shape check, the same
 * per-hour limit as the learning routes keyed by token and IP, then Odoo.
 *
 *   200 `{ ok: true }`              Odoo recorded it
 *   400 `{ error: "invalid_body" }`
 *   403 `{ error: "origin_not_allowed" | "not_a_tester" }`
 *   429 `{ error: "rate_limited" }`
 *   503 `{ error: "learning_disabled" }`
 *   502 `{ error: "upstream_failed" }`
 */
export function createPlannerTesterRoute(
  odoo: Pick<OdooClient, "planner">,
  kind: TesterKind,
  { allowedOrigins, now = Date.now, store }: TesterRouteOptions = {},
) {
  async function POST(req: Request): Promise<Response> {
    if (allowedOrigins) {
      const origin = req.headers.get("origin");
      if (!origin || !allowedOrigins.includes(origin)) return json({ error: "origin_not_allowed" }, 403);
    }
    const token = testerTokenFrom(req);
    if (!token) return json({ error: "not_a_tester" }, 403);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "invalid_body" }, 400);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "invalid_body" }, 400);
    const body = cleanTesterBody(kind, raw as Record<string, unknown>);
    if (!body) return json({ error: "invalid_body" }, 400);

    const t = now();
    if (overLimit(`${kind}:tester:${token}`, t, store) || overLimit(`${kind}:ip:${clientIp(req)}`, t, store)) {
      return json({ error: "rate_limited" }, 429);
    }

    try {
      const forwarded = { ...body, tester_token: token };
      const result =
        kind === "dispute"
          ? await odoo.planner.dispute(forwarded as never)
          : await odoo.planner.propose(forwarded as never);
      return json(result);
    } catch (err) {
      if (err instanceof OdooApiError) {
        if (err.status === 403) return json({ error: "not_a_tester" }, 403);
        if (err.status === 503 || err.status === 404) return json({ error: "learning_disabled" }, 503);
        if (err.status === 429) return json({ error: "rate_limited" }, 429);
        if (err.status === 400) return json({ error: "invalid_body" }, 400);
      }
      return json({ error: "upstream_failed" }, 502);
    }
  }
  return { POST };
}
