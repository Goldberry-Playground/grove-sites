import type {
  ApiPlannerSaveInput,
  ApiPlannerSignalInput,
  ApiPlannerSignalKind,
  ApiPlannerSuggestInput,
} from "@grove/odoo-client";
import type { PlanInput } from "@grove/planner";

/**
 * Browser-side learning signals (planner-winter-beta spec §B.2 / §C.1,
 * GOL-3550). Every call goes to this storefront's BFF, never to Odoo, and a
 * signal is fire-and-forget: a failure never changes what the page does. No
 * personal data: the only identity is a random id kept in localStorage so
 * Odoo can rate-limit and group a session's signals.
 */

export const BROWSER_ID_KEY = "grove_planner_browser_id";

/** The sliding window Odoo applies per browser id (spec §B.2). */
export const SIGNAL_LIMIT_PER_HOUR = 60;

function randomId(): string {
  const g = globalThis as { crypto?: Crypto };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID().replace(/-/g, "");
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/** The page's random browser id, minted once and kept in localStorage. */
export function browserId(storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): string {
  if (!storage) return randomId();
  try {
    const existing = storage.getItem(BROWSER_ID_KEY);
    if (existing && /^[A-Za-z0-9]{8,64}$/.test(existing)) return existing;
    const fresh = randomId();
    storage.setItem(BROWSER_ID_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

/** "3-5" | "6-7" | "8-9" for the winter-beta zone bands; null outside them. */
export function zoneBand(zone: number | null): "3-5" | "6-7" | "8-9" | null {
  if (zone == null) return null;
  if (zone >= 3 && zone <= 5) return "3-5";
  if (zone >= 6 && zone <= 7) return "6-7";
  if (zone >= 8 && zone <= 9) return "8-9";
  return null;
}

/** What every signal from one plan carries besides its kind and product. */
export interface SignalContext {
  input: PlanInput;
  /** The shareable quiz URL (`location.href` on the page). */
  planUrl: string;
  catalogVersion: number | null;
}

export function signalBody(
  kind: ApiPlannerSignalKind,
  ctx: SignalContext,
  productTmplId?: number | null,
  id: string = browserId(),
): ApiPlannerSignalInput {
  const zone = typeof ctx.input.zone === "number" ? ctx.input.zone : null;
  const band = zone != null ? zoneBand(zone) : bandForStateBand(ctx.input.zone);
  return {
    kind,
    browser_id: id,
    product_tmpl_id: productTmplId ?? null,
    zone,
    zone_band: band,
    track: ctx.input.track,
    site: ctx.input.site,
    timing: ctx.input.timing,
    plan_url: ctx.planUrl.slice(0, 2000),
    catalog_version: ctx.catalogVersion,
  };
}

/** A state band (unknown ZIP) buckets on its cold end, the way the planner scores it. */
function bandForStateBand(zone: PlanInput["zone"]): "3-5" | "6-7" | "8-9" | null {
  return typeof zone === "number" ? zoneBand(zone) : zoneBand(zone.band[0]);
}

async function post(path: string, body: unknown, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

/**
 * Post one signal and forget it. Resolves true when the BFF accepted it,
 * false otherwise (off switch, limit, network); never throws, never blocks
 * the UI that fired it.
 */
export async function postSignal(
  kind: ApiPlannerSignalKind,
  ctx: SignalContext,
  productTmplId?: number | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await post("/api/planner/signal", signalBody(kind, ctx, productTmplId), fetchImpl);
    return res.ok;
  } catch {
    return false;
  }
}

export type SaveOutcome = { ok: true; id: number | null } | { ok: false; reason: "off" | "limit" | "invalid" | "failed" };

/** Save a named plan (spec §B.7). The caller posts the `saved` signal on success. */
export async function postSave(
  body: Omit<ApiPlannerSaveInput, "browser_id">,
  fetchImpl: typeof fetch = fetch,
): Promise<SaveOutcome> {
  return outcome(() => post("/api/planner/save", { ...body, browser_id: browserId() }, fetchImpl));
}

/** Suggest a plant (spec §B.6). `company` is the honeypot the BFF checks. */
export async function postSuggest(
  body: Omit<ApiPlannerSuggestInput, "browser_id"> & { company?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SaveOutcome> {
  return outcome(() => post("/api/planner/suggest", { ...body, browser_id: browserId() }, fetchImpl));
}

async function outcome(send: () => Promise<Response>): Promise<SaveOutcome> {
  let res: Response;
  try {
    res = await send();
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (res.ok) {
    let id: number | null = null;
    try {
      const data = (await res.json()) as { id?: unknown };
      if (typeof data.id === "number") id = data.id;
    } catch {
      id = null;
    }
    return { ok: true, id };
  }
  if (res.status === 503) return { ok: false, reason: "off" };
  if (res.status === 429) return { ok: false, reason: "limit" };
  if (res.status === 400) return { ok: false, reason: "invalid" };
  return { ok: false, reason: "failed" };
}
