/**
 * Bridge → Odoo client for the operator mark-shipped signal (GOL-1980).
 *
 * Calls the bearer-auth'd `POST /grove/api/v1/orders/<id>/mark-shipped` endpoint
 * (grove_headless) with the scoped bridge service key (GOL-592). The endpoint is
 * idempotent, so a double-click returns 200 with `already_shipped: true`; a
 * non-2xx is a REAL failure the caller must surface to the operator as an
 * ephemeral error — never a silent ack (GOL-1975 guard).
 */

/** Config for the Odoo mark-shipped call. */
export interface OrderClientConfig {
  /** Odoo API base, e.g. https://odoo.qa.gatheringatthegrove.com. */
  odooApiBase: string;
  /** Scoped bridge→Odoo bearer service key (GOL-592). */
  odooBridgeKey: string;
}

/** Outcome of a mark-shipped call. `ok=false` ⇒ surface an ephemeral error. */
export interface MarkShippedResult {
  ok: boolean;
  /** HTTP status, or 0 when the request never completed (network error). */
  status: number;
  /** True when the order was already shipped (idempotent double-click). */
  alreadyShipped?: boolean;
  /** Order reference echoed back, for the operator-facing confirmation. */
  orderRef?: string;
  /** Tracking numbers persisted on the order, when any. */
  tracking?: string[];
  /** Human-readable error, present only when ok is false. */
  error?: string;
}

/**
 * POST the mark-shipped signal. Configuration is validated up front so a
 * missing key fails visibly here rather than as an opaque 401 from Odoo. Never
 * throws — every failure resolves to `{ ok: false, ... }` so the handler always
 * shows the operator a concrete outcome.
 */
export async function markShipped(
  cfg: OrderClientConfig,
  orderId: string,
  actor: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<MarkShippedResult> {
  if (!cfg.odooApiBase || !cfg.odooBridgeKey) {
    return { ok: false, status: 0, error: "Order write is not configured yet (missing Odoo bridge key)." };
  }
  const base = cfg.odooApiBase.replace(/\/$/, "");
  const url = `${base}/grove/api/v1/orders/${encodeURIComponent(orderId)}/mark-shipped`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.odooBridgeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actor ? { actor } : {}),
    });
  } catch (err) {
    return { ok: false, status: 0, error: `Could not reach Odoo: ${(err as Error).message}` };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON body (e.g. an HTML 401 page) — leave body empty */
  }

  if (!res.ok) {
    const detail = typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
    return { ok: false, status: res.status, error: detail };
  }

  return {
    ok: true,
    status: res.status,
    alreadyShipped: body.already_shipped === true,
    orderRef: typeof body.name === "string" ? body.name : undefined,
    tracking: Array.isArray(body.tracking_numbers)
      ? (body.tracking_numbers as unknown[]).filter((t): t is string => typeof t === "string")
      : undefined,
  };
}
