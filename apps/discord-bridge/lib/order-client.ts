/**
 * Bridge → Odoo client for operator order actions (GOL-1980, order lanes).
 *
 * Calls the bearer-auth'd `POST /grove/api/v1/orders/<id>/<route>` endpoints
 * (grove_headless: mark-shipped, hold, hold/release, hold/snooze, move,
 * label-refunded) with the scoped bridge service key (GOL-592). A non-2xx is a
 * REAL failure the caller must surface to the operator as an ephemeral error,
 * never a silent ack (GOL-1975 guard).
 */

/** Config for the Odoo order-action calls. */
export interface OrderClientConfig {
  /** Odoo API base, e.g. https://odoo.qa.gatheringatthegrove.com. */
  odooApiBase: string;
  /** Scoped bridge→Odoo bearer service key (GOL-592). */
  odooBridgeKey: string;
}

/** Outcome of an order action. `ok=false` ⇒ post `error` as an ephemeral message. */
export interface OrderActionResult {
  ok: boolean;
  /** HTTP status, or 0 when the request never completed. */
  status: number;
  /** Mark shipped only: the order was already shipped (idempotent double-click). */
  alreadyShipped?: boolean;
  /**
   * The rebuilt card payload. On success it can be null: the action happened but
   * the card couldn't be built, so confirm plainly and don't treat it as a failure.
   */
  card?: object | null;
  /** Message for the operator, present only when ok is false. */
  error?: string;
}

const UNREACHABLE = "Couldn't reach Odoo. Nothing changed; try again.";

/**
 * POST one order action to `/grove/api/v1/orders/<id>/<path>`. Odoo's 422/409
 * `error` strings are written for the operator and passed through as is; every
 * other failure (network, non-JSON, no error string) becomes one plain message,
 * never a status code or body. Never throws.
 */
export async function orderAction(
  cfg: OrderClientConfig,
  orderId: string,
  path: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderActionResult> {
  if (!cfg.odooApiBase || !cfg.odooBridgeKey) {
    return { ok: false, status: 0, error: "Order write is not configured yet (missing Odoo bridge key)." };
  }
  const base = cfg.odooApiBase.replace(/\/$/, "");
  const url = `${base}/grove/api/v1/orders/${encodeURIComponent(orderId)}/${path}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.odooBridgeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE };
  }

  let parsed: Record<string, unknown>;
  try {
    const json: unknown = await res.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("not an object");
    parsed = json as Record<string, unknown>;
  } catch {
    return { ok: false, status: res.status, error: UNREACHABLE };
  }

  if (!res.ok) {
    const error = typeof parsed.error === "string" && parsed.error.trim() ? parsed.error : UNREACHABLE;
    return { ok: false, status: res.status, error };
  }

  const card = parsed.card && typeof parsed.card === "object" ? parsed.card : null;
  return { ok: true, status: res.status, alreadyShipped: parsed.already_shipped === true, card };
}

/** What Mark all shipped came back with. */
export interface MarkAllResult {
  ok: boolean;
  /** HTTP status, or 0 when the request never completed. */
  status: number;
  /** Odoo refused up front (409): nothing changed, and the button can be pressed again later. */
  refused?: boolean;
  /** Message for the operator, present only when ok is false. */
  error?: string;
  shipped?: number;
  already?: number;
  skipped?: Array<{ order: string; reason: string }>;
}

/**
 * Mark all shipped emails every customer in the batch and Odoo commits each order
 * as it ships, so a batch of ~30 orders takes a while. Three minutes is well over
 * that and well under the 15 minutes Discord keeps the interaction token alive.
 */
export const MARK_ALL_TIMEOUT_MS = 180_000;

/** Used when we cannot say whether anything shipped; marking twice is safe. */
export const MARK_ALL_UNSURE = "Odoo may still be working, check the orders before retrying. Marking twice is safe.";

function isSkipped(v: unknown): v is { order: string; reason: string } {
  const s = v as { order?: unknown; reason?: unknown } | null;
  return !!s && typeof s.order === "string" && typeof s.reason === "string";
}

/**
 * POST `/grove/api/v1/label-batches/<id>/mark-shipped`. Kept apart from
 * `orderAction` because it answers counts rather than a card, runs long, and a
 * failure after the request left may still have shipped orders. A 409 is a
 * refusal with nothing changed (`refused`); any other failure, including a
 * timeout, says Odoo may still be working. Never throws.
 */
export async function markBatchShipped(
  cfg: OrderClientConfig,
  batchId: string,
  actor: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = MARK_ALL_TIMEOUT_MS,
): Promise<MarkAllResult> {
  if (!cfg.odooApiBase || !cfg.odooBridgeKey) {
    return { ok: false, status: 0, error: "Order write is not configured yet (missing Odoo bridge key)." };
  }
  const base = cfg.odooApiBase.replace(/\/$/, "");
  const url = `${base}/grove/api/v1/label-batches/${encodeURIComponent(batchId)}/mark-shipped`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.odooBridgeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ actor }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, status: 0, error: MARK_ALL_UNSURE };
  }

  let parsed: Record<string, unknown>;
  try {
    const json: unknown = await res.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("not an object");
    parsed = json as Record<string, unknown>;
  } catch {
    return { ok: false, status: res.status, error: MARK_ALL_UNSURE };
  }

  if (!res.ok) {
    const message = typeof parsed.error === "string" && parsed.error.trim() ? parsed.error : "";
    if (res.status === 409 && message) return { ok: false, status: 409, refused: true, error: message };
    // 404 and 422 changed nothing, but Odoo's own words are all we pass on; a 500
    // writes its own "check the orders" message.
    return { ok: false, status: res.status, error: message || MARK_ALL_UNSURE };
  }

  const { shipped, already, skipped } = parsed;
  if (
    typeof shipped !== "number" ||
    typeof already !== "number" ||
    !Array.isArray(skipped) ||
    !skipped.every(isSkipped)
  ) {
    return { ok: false, status: res.status, error: MARK_ALL_UNSURE };
  }
  return { ok: true, status: res.status, shipped, already, skipped };
}
