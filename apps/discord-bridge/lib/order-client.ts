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
