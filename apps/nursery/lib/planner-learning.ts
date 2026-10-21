import { OdooApiError, type OdooClient } from "@grove/odoo-client";

/**
 * Shared handler for the planner learning-loop BFF routes (planner-winter-beta
 * spec §C, GOL-3550): `POST /api/planner/{signal,suggest,save}`.
 *
 * Each route is a passthrough to the grove_headless public write route of the
 * same name, with the same three guards the newsletter form gets at this
 * layer:
 *
 *   1. an `Origin` allowlist (403 off-site), the gate the lead and restock
 *      routes use, so a script cannot write signals from elsewhere;
 *   2. a honeypot: a non-empty `company` field is a bot, answered 200 and
 *      dropped so the bot learns nothing (same as `CaptureForm`);
 *   3. a per-client sliding-window limit mirrored from Odoo's 60 per browser
 *      id per hour (429), keyed by browser id and client IP, so a flood never
 *      reaches Odoo at all. In-memory per instance, which is enough to blunt
 *      a loop; Odoo's own limit is the one that counts.
 *
 * Status mapping (what the page relies on):
 *   200 `{ ok: true, ... }`          Odoo accepted it
 *   400 `{ error: "invalid_body" }`  malformed here or in Odoo
 *   403 `{ error: "origin_not_allowed" }`
 *   429 `{ error: "rate_limited" }`
 *   503 `{ error: "learning_disabled" }` Odoo's kill switch (or no backend);
 *                                     the page treats this as a silent no-op
 *   502 `{ error: "upstream_failed" }` anything else from Odoo
 */

export const LEARNING_LIMIT_PER_HOUR = 60;
export const LEARNING_WINDOW_MS = 60 * 60 * 1000;
const MAX_BROWSER_ID = 64;
const MAX_BODY_BYTES = 32 * 1024;

export type LearningKind = "signal" | "suggest" | "save";

export interface LearningRouteOptions {
  allowedOrigins?: readonly string[];
  /** Injectable clock (tests). */
  now?: () => number;
  /** Injectable limiter store (tests); defaults to one map per process. */
  store?: Map<string, number[]>;
}

const SIGNAL_KINDS = new Set(["removed", "swapped", "added", "built", "saved"]);
const STRATA = new Set(["overstory", "understory", "mushroom"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const defaultStore = new Map<string, number[]>();

/** Drop every limiter window (tests). */
export function resetLearningLimiter(store: Map<string, number[]> = defaultStore): void {
  store.clear();
}

/**
 * True when `key` has made `LEARNING_LIMIT_PER_HOUR` requests inside the last
 * hour; records this request otherwise. Old keys are swept as they expire so
 * the map cannot grow with the number of visitors.
 */
export function overLimit(key: string, now: number, store: Map<string, number[]> = defaultStore): boolean {
  const since = now - LEARNING_WINDOW_MS;
  const hits = (store.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= LEARNING_LIMIT_PER_HOUR) {
    store.set(key, hits);
    return true;
  }
  hits.push(now);
  store.set(key, hits);
  if (store.size > 5000) {
    for (const [k, v] of store) if (!v.some((t) => t > since)) store.delete(k);
  }
  return false;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function int(v: unknown): number | null | undefined {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v)) return Number(v);
  return undefined;
}

/** Shape-check the body for `kind`; returns the clean body or null. Odoo validates strictly again. */
export function cleanBody(kind: LearningKind, raw: Record<string, unknown>): Record<string, unknown> | null {
  const browser_id = text(raw.browser_id, MAX_BROWSER_ID);
  if (!browser_id || !/^[A-Za-z0-9_-]+$/.test(browser_id)) return null;
  if (kind === "signal") {
    const k = text(raw.kind, 20);
    if (!k || !SIGNAL_KINDS.has(k)) return null;
    const product_tmpl_id = int(raw.product_tmpl_id);
    const zone = int(raw.zone);
    const catalog_version = int(raw.catalog_version);
    if (product_tmpl_id === undefined || zone === undefined || catalog_version === undefined) return null;
    if (product_tmpl_id == null && k !== "built" && k !== "saved") return null;
    return {
      kind: k,
      browser_id,
      product_tmpl_id,
      zone,
      zone_band: text(raw.zone_band, 5),
      track: text(raw.track, 100),
      site: text(raw.site, 100),
      timing: text(raw.timing, 100),
      plan_url: text(raw.plan_url, 2000),
      catalog_version,
    };
  }
  if (kind === "suggest") {
    const name = text(raw.name, 200);
    if (!name) return null;
    const stratum = text(raw.stratum, 20);
    if (stratum && !STRATA.has(stratum)) return null;
    return { name, stratum, note: text(raw.note, 2000), browser_id };
  }
  const name = text(raw.name, 200);
  if (!name || !Array.isArray(raw.lines) || raw.lines.length === 0 || raw.lines.length > 60) return null;
  const lines: Record<string, unknown>[] = [];
  for (const entry of raw.lines) {
    if (!entry || typeof entry !== "object") return null;
    const e = entry as Record<string, unknown>;
    const product_tmpl_id = int(e.product_tmpl_id);
    const qty = typeof e.qty === "number" && Number.isFinite(e.qty) && e.qty > 0 ? e.qty : null;
    if (!product_tmpl_id || !qty) return null;
    lines.push({ product_tmpl_id, qty, role: text(e.role, 100), stratum: text(e.stratum, 100) });
  }
  const zone = int(raw.zone);
  if (zone === undefined) return null;
  return { name, plan_url: text(raw.plan_url, 2000), lines, zone, track: text(raw.track, 100), browser_id };
}

export function createPlannerLearningRoute(
  odoo: OdooClient,
  kind: LearningKind,
  { allowedOrigins, now = Date.now, store = defaultStore }: LearningRouteOptions = {},
) {
  async function POST(req: Request): Promise<Response> {
    if (allowedOrigins) {
      const origin = req.headers.get("origin");
      if (!origin || !allowedOrigins.includes(origin)) return json({ error: "origin_not_allowed" }, 403);
    }
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) return json({ error: "invalid_body" }, 400);

    let raw: Record<string, unknown>;
    try {
      raw = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "invalid_body" }, 400);

    // Honeypot: humans never see `company`. A bot that filled it gets a 200
    // and nothing is written, so it cannot tell it was caught.
    if (typeof raw.company === "string" && raw.company.trim() !== "") return json({ ok: true, id: null });

    const body = cleanBody(kind, raw);
    if (!body) return json({ error: "invalid_body" }, 400);

    const t = now();
    if (overLimit(`${kind}:${body.browser_id as string}`, t, store) || overLimit(`${kind}:ip:${clientIp(req)}`, t, store)) {
      return json({ error: "rate_limited" }, 429);
    }

    try {
      const result =
        kind === "signal"
          ? await odoo.planner.signal(body as never)
          : kind === "suggest"
            ? await odoo.planner.suggest(body as never)
            : await odoo.planner.save(body as never);
      return json(result);
    } catch (err) {
      if (err instanceof OdooApiError) {
        if (err.status === 503 || err.status === 404) return json({ error: "learning_disabled" }, 503);
        if (err.status === 429) return json({ error: "rate_limited" }, 429);
        if (err.status === 400) return json({ error: "invalid_body" }, 400);
      }
      return json({ error: "upstream_failed" }, 502);
    }
  }
  return { POST };
}
