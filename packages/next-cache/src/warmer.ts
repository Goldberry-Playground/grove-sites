import { type CacheStore, createValkeyStore, withBreaker } from "./store";

const LOCK_NAME = "warm";
const LOCK_TTL_SECONDS = 270;
const FETCH_TIMEOUT_MS = 15_000;

export interface WarmDeps {
  store: CacheStore;
  listPaths(): Promise<string[]>;
  fetchPath(path: string): Promise<{ status: number }>;
  /** Parallel requests. Default 2. */
  concurrency?: number;
  /** Pause after each request, per worker. Default 250ms. */
  gapMs?: number;
}

export interface WarmResult {
  warmed: number;
  failed: number;
  skipped: boolean;
}

function log(message: string, err?: unknown): void {
  const detail = err instanceof Error ? ` (${err.name}: ${err.message})` : "";
  console.warn(`[grove-warmer] ${message}${detail}`);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One warming cycle: takes the shared `warm` lock (so only one instance warms per window),
 * then requests every listed path with bounded concurrency. Never rejects.
 */
export async function warmOnce(deps: WarmDeps): Promise<WarmResult> {
  const concurrency = Math.max(1, deps.concurrency ?? 2);
  const gapMs = deps.gapMs ?? 250;

  try {
    if (!(await deps.store.acquireLock(LOCK_NAME, LOCK_TTL_SECONDS))) {
      return { warmed: 0, failed: 0, skipped: true };
    }
  } catch (err) {
    log("could not take the warm lock; skipping this cycle", err);
    return { warmed: 0, failed: 0, skipped: true };
  }

  let paths: string[];
  try {
    paths = await deps.listPaths();
  } catch (err) {
    log("could not list product paths", err);
    return { warmed: 0, failed: 0, skipped: false };
  }

  let warmed = 0;
  let failed = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const { status } = await deps.fetchPath(path);
        if (status === 200) warmed++;
        else {
          failed++;
          log(`${path} returned ${status}`);
        }
      } catch (err) {
        failed++;
        log(`${path} failed`, err);
      }
      if (gapMs > 0 && next < paths.length) await sleep(gapMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  log(`cycle done: ${warmed} warmed, ${failed} failed`);
  return { warmed, failed, skipped: false };
}

/**
 * Warms after `startDelayMs` (default 20s) and then every `intervalMs` (default 5min).
 * Timers are unref'd. Returns a stop function.
 */
export function startWarmer(
  deps: WarmDeps,
  opts: { startDelayMs?: number; intervalMs?: number } = {},
): () => void {
  const startDelayMs = opts.startDelayMs ?? 20_000;
  const intervalMs = opts.intervalMs ?? 300_000;
  let interval: ReturnType<typeof setInterval> | undefined;
  const run = () => {
    warmOnce(deps).catch((err) => log("cycle failed", err));
  };
  const first = setTimeout(() => {
    run();
    interval = setInterval(run, intervalMs);
    interval.unref();
  }, startDelayMs);
  first.unref();
  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
}

/**
 * Starts the warmer for a storefront app, only when the shared cache is on (`VALKEY_URL`
 * and `GROVE_CACHE_NAMESPACE` both set). Requests go to this instance's own server on
 * `PORT`, so the normal cached render path does the work. Returns `null` when off.
 */
export function startCatalogWarmer(
  app: { listPaths(): Promise<string[]> },
  env: Record<string, string | undefined> = process.env,
): (() => void) | null {
  const url = env.VALKEY_URL;
  const namespace = env.GROVE_CACHE_NAMESPACE;
  if (!url || !namespace) return null;
  const port = env.PORT;
  if (!port) return null;
  const store = withBreaker(createValkeyStore(url, namespace));
  return startWarmer({
    store,
    listPaths: app.listPaths,
    fetchPath: async (path) => {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      await res.arrayBuffer();
      return { status: res.status };
    },
  });
}

/**
 * Pages through a list endpoint until `count` is exhausted and maps each item to a path
 * (`null` skips the item). Stops early on an empty page so a bad count cannot loop.
 */
export async function collectPaths<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ count: number; items: T[] }>,
  toPath: (item: T) => string | null,
  pageSize = 100,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset, pageSize);
    for (const item of page.items) {
      const path = toPath(item);
      if (path) paths.push(path);
    }
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.count) return paths;
  }
}
