import type { EnvMap } from "./odoo";

/**
 * Operator alert for a capture route that answered 5xx (GOL-3456).
 *
 * Why: the 2026-10-15 Ghost outage turned every storefront signup into a 5xx
 * for days and nobody noticed, because the only trace was a server log line
 * nobody was tailing. A capture route failing is a lost subscriber per
 * attempt, so it now does two things on every 5xx:
 *
 *   1. Writes ONE grep-able line, `[grove-capture] ALERT <app> <route> -> <status>`,
 *      to the server log (the DigitalOcean runtime log every operator can open).
 *   2. If `CAPTURE_ALERT_WEBHOOK_URL` is set, POSTs a short message to that
 *      Discord-compatible webhook (the same ops channel grove_headless uses for
 *      lead pings), throttled to one post per app+route per 10 minutes so a
 *      sustained outage is one ping, not a flood.
 *
 * Best-effort and never throws: an alert that cannot be delivered must not
 * turn a 503 into a crash. The webhook env is provisioned per app by DevOps;
 * until then only the log line fires.
 */
export interface CaptureFailure {
  /** Tenant / app slug, e.g. `nursery`. */
  app: string;
  /** Route path, e.g. `/api/newsletter/subscribe`. */
  route: string;
  /** The status the route is about to return to the browser (5xx). */
  status: number;
  /** Short operator-facing reason (no customer data). */
  detail?: string;
}

export interface CaptureAlertOptions {
  env?: EnvMap;
  fetchImpl?: typeof fetch;
  /** Clock seam for the throttle (ms since epoch). */
  now?: () => number;
  /** Log seam; defaults to `console.error`. */
  log?: (line: string) => void;
}

/** One webhook post per app+route inside this window. */
export const CAPTURE_ALERT_THROTTLE_MS = 10 * 60 * 1000;

const lastPostedAt = new Map<string, number>();

/** Test seam: forget every throttle timestamp. */
export function resetCaptureAlertThrottle(): void {
  lastPostedAt.clear();
}

function ambientEnv(): EnvMap {
  return (globalThis as { process?: { env?: EnvMap } }).process?.env ?? {};
}

export async function reportCaptureFailure(
  failure: CaptureFailure,
  {
    env = ambientEnv(),
    fetchImpl = fetch,
    now = Date.now,
    // eslint-disable-next-line no-console -- intentional operator log line
    log = (line) => console.error(line),
  }: CaptureAlertOptions = {},
): Promise<void> {
  const line =
    `[grove-capture] ALERT ${failure.app} ${failure.route} -> ${failure.status}` +
    (failure.detail ? `: ${failure.detail}` : "");
  try {
    log(line);
  } catch {
    // A broken logger must not take the route down.
  }

  const url = env.CAPTURE_ALERT_WEBHOOK_URL?.trim();
  if (!url) return;

  const key = `${failure.app} ${failure.route}`;
  const at = now();
  const last = lastPostedAt.get(key);
  if (last !== undefined && at - last < CAPTURE_ALERT_THROTTLE_MS) return;
  lastPostedAt.set(key, at);

  try {
    await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `:rotating_light: ${line}`,
        // Disarm every mention: nothing from a request body ever reaches
        // this message, but keep the same stance as grove_headless (GOL-1933).
        allowed_mentions: { parse: [] },
      }),
    });
  } catch {
    // Best-effort. The log line above already fired.
  }
}
