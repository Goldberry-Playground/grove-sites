import Valkey from "iovalkey";

/**
 * Storage behind the shared data cache. Keys passed in are relative to the store's
 * namespace (`grove:<namespace>:` is added by the store).
 */
export interface CacheStore {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, ttlSeconds: number): Promise<void>;
  /** Last flush time (ms) per tag, `null` for a tag never flushed. */
  tagTimes(tags: string[]): Promise<Array<number | null>>;
  /** Records `at` (ms) as the flush time of every tag. */
  touchTags(tags: string[], at: number): Promise<void>;
  /** Takes the named lock for `ttlSeconds`. `false` when another holder has it. */
  acquireLock(name: string, ttlSeconds: number): Promise<boolean>;
  /**
   * Current time in ms from the store's clock (Valkey `TIME`). Entry stamps and tag flush
   * times both use it, so clock skew between instances cannot hide a flush.
   */
  now(): Promise<number>;
}

/** Thrown by a breaker-wrapped store while the breaker is open. */
export class BreakerOpenError extends Error {
  constructor() {
    super("cache store breaker is open");
    this.name = "BreakerOpenError";
  }
}

/**
 * Thrown when the Valkey client has not connected (yet). It is not a failure of the store,
 * so it never opens the breaker.
 */
export class StoreNotReadyError extends Error {
  constructor() {
    super("cache store is not connected");
    this.name = "StoreNotReadyError";
  }
}

/** The subset of an iovalkey client the store uses. */
export interface ValkeyClientLike {
  readonly status: string;
  once(event: "ready", listener: () => void): unknown;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: "EX", ttl: number, nx?: "NX"): Promise<"OK" | null>;
  hmget(key: string, ...fields: string[]): Promise<Array<string | null>>;
  hset(key: string, values: Record<string, string>): Promise<number>;
  time(): Promise<Array<string | number>>;
}

export interface ValkeyStoreOptions {
  /** How long the first command waits for the initial connect. Default 500ms. */
  firstReadyCapMs?: number;
}

/**
 * Builds a store over an existing client. The first command waits once (capped) for the
 * initial connect; after that, any command issued while the client is not ready rejects
 * with `StoreNotReadyError` straight away.
 */
export function createValkeyStoreFromClient(
  client: ValkeyClientLike,
  namespace: string,
  opts: ValkeyStoreOptions = {},
): CacheStore {
  const prefix = `grove:${namespace}:`;
  const tagsKey = `${prefix}tags`;
  const capMs = opts.firstReadyCapMs ?? 500;
  let firstReady: Promise<void> | null = null;

  async function ready(): Promise<void> {
    if (client.status === "ready") return;
    if (!firstReady) {
      firstReady = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, capMs);
        client.once("ready", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await firstReady;
    if (client.status !== "ready") throw new StoreNotReadyError();
  }

  return {
    async get(k) {
      await ready();
      return client.get(prefix + k);
    },
    async set(k, v, ttlSeconds) {
      await ready();
      await client.set(prefix + k, v, "EX", ttlSeconds);
    },
    async tagTimes(tags) {
      if (tags.length === 0) return [];
      await ready();
      const raw = await client.hmget(tagsKey, ...tags);
      return raw.map((v) => {
        const n = v === null ? NaN : Number(v);
        return Number.isFinite(n) ? n : null;
      });
    },
    async touchTags(tags, at) {
      if (tags.length === 0) return;
      await ready();
      await client.hset(tagsKey, Object.fromEntries(tags.map((t) => [t, String(at)])));
    },
    async acquireLock(name, ttlSeconds) {
      await ready();
      return (await client.set(`${prefix}lock:${name}`, "1", "EX", ttlSeconds, "NX")) === "OK";
    },
    async now() {
      await ready();
      const [sec, micro] = await client.time();
      return Number(sec) * 1000 + Math.floor(Number(micro) / 1000);
    },
  };
}

/**
 * Valkey-backed store. The client is created (and starts connecting) immediately. Commands
 * time out after 150ms and are never queued or retried, so a hung Valkey costs at most
 * one timeout per call.
 */
export function createValkeyStore(url: string, namespace: string): CacheStore {
  const client = new Valkey(url, {
    commandTimeout: 150,
    connectTimeout: 1000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
  });
  // Connection errors surface as rejected commands. Never let them crash the process.
  client.on("error", () => {});
  const adapter: ValkeyClientLike = {
    get status() {
      return client.status;
    },
    once: (event, listener) => client.once(event, listener),
    get: (key) => client.get(key),
    set: (key, value, ex, ttl, nx) =>
      nx ? client.set(key, value, ex, ttl, nx) : client.set(key, value, ex, ttl),
    hmget: (key, ...fields) => client.hmget(key, ...fields),
    hset: (key, values) => client.hset(key, values),
    time: () => client.time(),
  };
  return createValkeyStoreFromClient(adapter, namespace);
}

/**
 * Wraps a store in a circuit breaker. Any failure opens it for `openMs` (default 10s);
 * while open, every call rejects with `BreakerOpenError` without touching the store. The
 * first call after that goes through again. `StoreNotReadyError` does not open it.
 */
export function withBreaker(store: CacheStore, opts: { openMs?: number } = {}): CacheStore {
  const openMs = opts.openMs ?? 10_000;
  let openUntil = 0;

  async function guard<T>(call: () => Promise<T>): Promise<T> {
    if (Date.now() < openUntil) throw new BreakerOpenError();
    try {
      return await call();
    } catch (err) {
      if (!(err instanceof StoreNotReadyError)) openUntil = Date.now() + openMs;
      throw err;
    }
  }

  return {
    get: (k) => guard(() => store.get(k)),
    set: (k, v, ttl) => guard(() => store.set(k, v, ttl)),
    tagTimes: (tags) => guard(() => store.tagTimes(tags)),
    touchTags: (tags, at) => guard(() => store.touchTags(tags, at)),
    acquireLock: (name, ttl) => guard(() => store.acquireLock(name, ttl)),
    now: () => guard(() => store.now()),
  };
}
