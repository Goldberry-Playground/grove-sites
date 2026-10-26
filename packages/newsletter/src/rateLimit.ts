/**
 * In-memory sliding-window rate limiter for the newsletter subscribe route
 * (GOL-3586).
 *
 * The Origin allowlist is forgeable with curl, and a subscribe is a single
 * opt-in + an Odoo welcome email, so an unthrottled route is an
 * email-bombing / list-spam vector. This blunts a flood per instance before it
 * reaches Odoo; it is a front-line guard, not the system of record.
 *
 * Mirrors the planner learning-loop limiter (apps/nursery/lib/planner-learning.ts)
 * and the checkout package's copy — same window shape, same unbounded-growth
 * sweep. Kept as a package-local copy because packages cannot depend on app
 * code and the two live in different workspaces; see the PR note on folding
 * these into a shared util.
 *
 * Per-process: it resets on redeploy and does not coordinate across instances,
 * which is enough to stop a naive loop — the real threat here.
 */
export const SUBSCRIBE_LIMIT = 10;
export const SUBSCRIBE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_KEY = 254;

const defaultStore = new Map<string, number[]>();

/** Drop every limiter window (tests). */
export function resetSubscribeLimiter(store: Map<string, number[]> = defaultStore): void {
  store.clear();
}

/** First-forwarded client IP, bounded; `"unknown"` when no proxy header is set. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

/**
 * True when `key` has already made {@link SUBSCRIBE_LIMIT} requests inside the
 * last window; records this request otherwise. Expired keys are swept once the
 * map grows past a bound so it cannot grow with the number of visitors.
 */
export function overLimit(
  key: string,
  now: number,
  store: Map<string, number[]> = defaultStore,
): boolean {
  const k = key.slice(0, MAX_KEY);
  const since = now - SUBSCRIBE_WINDOW_MS;
  const hits = (store.get(k) ?? []).filter((t) => t > since);
  if (hits.length >= SUBSCRIBE_LIMIT) {
    store.set(k, hits);
    return true;
  }
  hits.push(now);
  store.set(k, hits);
  if (store.size > 5000) {
    for (const [key2, v] of store) if (!v.some((t) => t > since)) store.delete(key2);
  }
  return false;
}
