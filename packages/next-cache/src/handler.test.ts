import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CacheValue,
  createGroveCacheHandler,
  type FileCache,
  type HandlerContext,
  type HandlerDeps,
  storesFromEnv,
} from "./handler";
import { BreakerOpenError, type CacheStore, StoreNotReadyError, withBreaker } from "./store";

const fileCacheInstances = vi.hoisted(() => [] as Array<{ ctx: unknown; calls: string[] }>);

vi.mock("next/dist/server/lib/incremental-cache/file-system-cache", () => ({
  default: class {
    calls: string[] = [];
    constructor(public ctx: unknown) {
      fileCacheInstances.push(this);
    }
    async get(key: string): Promise<null> {
      this.calls.push(`get:${key}`);
      return null;
    }
    async set(key: string): Promise<void> {
      this.calls.push(`set:${key}`);
    }
    async revalidateTag(): Promise<void> {
      this.calls.push("revalidateTag");
    }
    resetRequestCache(): void {}
  },
}));

/** In-memory CacheStore. Keys are recorded exactly as the handler passes them. */
class FakeStore implements CacheStore {
  data = new Map<string, { value: string; ttl: number }>();
  tags = new Map<string, number>();
  failing = false;
  calls = 0;

  private check(): void {
    this.calls++;
    if (this.failing) throw new Error("ETIMEDOUT");
  }
  async get(k: string): Promise<string | null> {
    this.check();
    return this.data.get(k)?.value ?? null;
  }
  async set(k: string, v: string, ttlSeconds: number): Promise<void> {
    this.check();
    this.data.set(k, { value: v, ttl: ttlSeconds });
  }
  async tagTimes(tags: string[]): Promise<Array<number | null>> {
    this.check();
    return tags.map((t) => this.tags.get(t) ?? null);
  }
  async touchTags(tags: string[], at: number): Promise<void> {
    this.check();
    for (const t of tags) this.tags.set(t, at);
  }
  async acquireLock(): Promise<boolean> {
    this.check();
    return true;
  }
  async now(): Promise<number> {
    this.check();
    return Date.now();
  }
}

/** File cache double. `entries` is what `get` returns. */
function fakeFileCache(): FileCache & {
  calls: string[];
  entries: Map<string, { lastModified?: number; value: CacheValue }>;
} {
  const fc = {
    calls: [] as string[],
    entries: new Map<string, { lastModified?: number; value: CacheValue }>(),
    async get(key: string) {
      fc.calls.push(`get:${key}`);
      return fc.entries.get(key) ?? null;
    },
    async set(key: string) {
      fc.calls.push(`set:${key}`);
    },
    async revalidateTag(tags: string | string[]) {
      fc.calls.push(`revalidateTag:${[tags].flat().join(",")}`);
    },
    resetRequestCache() {
      fc.calls.push("reset");
    },
  };
  return fc;
}

const CTOR_CTX: HandlerContext = { serverDistDir: "/app/.next/server", revalidatedTags: [] };

function setup(over: Partial<HandlerDeps> = {}) {
  const store = new FakeStore();
  const file = fakeFileCache();
  const log = vi.fn();
  const deps: HandlerDeps = {
    store,
    flushStore: store,
    createFileCache: () => file,
    buildId: () => "BUILD123",
    log,
    ...over,
  };
  const Handler = createGroveCacheHandler(deps);
  return { store, file, log, handler: new Handler(CTOR_CTX), Handler };
}

const fetchValue = (body: string, tags: string[] = []): CacheValue => ({
  kind: "FETCH",
  data: { headers: {}, body, status: 200, url: "http://odoo/x" },
  revalidate: 30,
  tags,
});

const fetchSetCtx = (tags: string[]) => ({ fetchCache: true as const, tags });
const fetchGetCtx = (tags: string[], softTags: string[] = []) => ({
  kind: "FETCH",
  tags,
  softTags,
});

const ROUTE_KEY = "/route-cache/APP_ROUTE/abc/$/sitemap.xml";
const routeValue = (tags: string): CacheValue => ({
  kind: "APP_ROUTE",
  body: Buffer.from("<urlset/>"),
  status: 200,
  headers: { "x-next-cache-tags": tags },
});

describe("GroveCacheHandler with Valkey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns a stored entry", async () => {
    const { handler } = setup();
    const value = fetchValue("a", ["grove-catalog"]);
    await handler.set("k1", value, fetchSetCtx(["grove-catalog"]));
    const got = await handler.get("k1", fetchGetCtx(["grove-catalog"]));
    expect(got).toEqual({ lastModified: Date.now(), value });
  });

  it("misses when any tag was flushed after lastModified", async () => {
    const { handler } = setup();
    await handler.set("k1", fetchValue("a"), fetchSetCtx(["grove-product-1", "other"]));
    vi.advanceTimersByTime(1000);
    await handler.revalidateTag("other");
    expect(await handler.get("k1", fetchGetCtx([]))).toBeNull();
  });

  it("misses when a soft tag was flushed after lastModified", async () => {
    const { handler } = setup();
    await handler.set("k1", fetchValue("a"), fetchSetCtx(["grove-catalog"]));
    vi.advanceTimersByTime(1000);
    await handler.revalidateTag(["_N_T_/shop"]);
    const ctx = fetchGetCtx(["grove-catalog"], ["_N_T_/layout", "_N_T_/shop"]);
    expect(await handler.get("k1", ctx)).toBeNull();
    const otherPage = fetchGetCtx(["grove-catalog"], ["_N_T_/layout", "_N_T_/about"]);
    expect(await handler.get("k1", otherPage)).not.toBeNull();
  });

  it("misses when a flush lands in the same millisecond as the write", async () => {
    const { handler } = setup();
    await handler.set("k1", fetchValue("a"), fetchSetCtx(["grove-catalog"]));
    await handler.revalidateTag("grove-catalog");
    expect(await handler.get("k1", fetchGetCtx(["grove-catalog"]))).toBeNull();
  });

  it("keeps an entry whose tags were flushed before it was written", async () => {
    const { handler } = setup();
    await handler.revalidateTag("grove-catalog");
    vi.advanceTimersByTime(1);
    await handler.set("k1", fetchValue("a"), fetchSetCtx(["grove-catalog"]));
    expect(await handler.get("k1", fetchGetCtx(["grove-catalog"]))).not.toBeNull();
  });

  it("misses tags this request already revalidated", async () => {
    const { store } = setup();
    const Handler = createGroveCacheHandler({
      store,
      flushStore: store,
      createFileCache: fakeFileCache,
      buildId: () => "B",
    });
    await new Handler(CTOR_CTX).set("k1", fetchValue("a"), fetchSetCtx(["grove-catalog"]));
    const later = new Handler({ ...CTOR_CTX, revalidatedTags: ["grove-catalog"] });
    expect(await later.get("k1", fetchGetCtx(["grove-catalog"]))).toBeNull();
  });

  it("misses a product entry older than 600s", async () => {
    const { handler, store } = setup();
    await handler.set("k1", fetchValue("a"), fetchSetCtx(["grove-product-9"]));
    expect(store.data.get("d:k1")?.ttl).toBe(600);
    vi.advanceTimersByTime(600_000);
    expect(await handler.get("k1", fetchGetCtx(["grove-product-9"]))).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(await handler.get("k1", fetchGetCtx(["grove-product-9"]))).toBeNull();
  });

  it("keeps a non-product entry older than 600s", async () => {
    const { handler, store } = setup();
    await handler.set("k1", fetchValue("a"), fetchSetCtx(["ghost-posts"]));
    expect(store.data.get("d:k1")?.ttl).toBe(86_400);
    vi.advanceTimersByTime(3_600_000);
    expect(await handler.get("k1", fetchGetCtx(["ghost-posts"]))).not.toBeNull();
  });

  it("FETCH key excludes the build id; APP_PAGE key includes it", async () => {
    const { handler, store } = setup();
    await handler.set("fetchkey", fetchValue("a"), fetchSetCtx([]));
    const page: CacheValue = {
      kind: "APP_PAGE",
      html: "<html/>",
      rscData: Buffer.from("rsc"),
      headers: {},
      segmentData: new Map([["/_tree", Buffer.from("t")]]),
    };
    await handler.set("/route-cache/APP_PAGE/h/$/shop", page, { cacheControl: { revalidate: 30 } });
    expect([...store.data.keys()].sort()).toEqual([
      "b:BUILD123:/route-cache/APP_PAGE/h/$/shop",
      "d:fetchkey",
    ]);
    const got = await handler.get("/route-cache/APP_PAGE/h/$/shop", { kind: "APP_PAGE" });
    expect(got?.value).toEqual(page);
  });

  it("round-trips a route entry with a Buffer body and checks its header tags", async () => {
    const { handler } = setup();
    await handler.set(ROUTE_KEY, routeValue("_N_T_/sitemap.xml,grove-catalog"), {});
    const hit = await handler.get(ROUTE_KEY, { kind: "APP_ROUTE" });
    const body = (hit?.value as { body: Buffer } | null)?.body;
    expect(Buffer.isBuffer(body) && body.toString()).toBe("<urlset/>");
    vi.advanceTimersByTime(5);
    await handler.revalidateTag("_N_T_/sitemap.xml");
    expect(await handler.get(ROUTE_KEY, { kind: "APP_ROUTE" })).toBeNull();
  });

  it("treats invalid JSON and v !== 1 as a miss", async () => {
    const { handler, store } = setup();
    const ctx = fetchGetCtx([]);
    store.data.set("d:bad", { value: "{not json", ttl: 1 });
    const old = JSON.stringify({ v: 0, lastModified: 1, value: {} });
    store.data.set("d:old", { value: old, ttl: 1 });
    store.data.set("d:trunc", { value: '{"v":1,"lastModified":', ttl: 1 });
    store.data.set("d:shape", { value: JSON.stringify({ v: 1, lastModified: "x" }), ttl: 1 });
    for (const k of ["bad", "old", "trunc", "shape"]) {
      await expect(handler.get(k, ctx)).resolves.toBeNull();
    }
  });

  it("get resolves null when the store rejects", async () => {
    const { handler, store, file } = setup();
    store.failing = true;
    await expect(handler.get("k1", fetchGetCtx(["grove-catalog"]))).resolves.toBeNull();
    expect(file.calls).toContain("get:k1");
  });

  it("set and revalidateTag resolve when the store rejects", async () => {
    const { handler, store, log } = setup();
    store.failing = true;
    await expect(handler.set("k1", fetchValue("a"), fetchSetCtx([]))).resolves.toBeUndefined();
    await expect(handler.revalidateTag("grove-catalog")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("revalidateTag"), expect.any(Error));
  });

  it("revalidateTag bypasses an open breaker", async () => {
    const raw = new FakeStore();
    const gated = withBreaker(raw);
    const { handler } = setup({ store: gated, flushStore: raw });
    raw.failing = true;
    await handler.get("k1", fetchGetCtx([]));
    await expect(gated.get("x")).rejects.toBeInstanceOf(BreakerOpenError);
    raw.failing = false;
    await handler.revalidateTag("grove-catalog");
    expect(raw.tags.get("grove-catalog")).toBe(Date.now());
  });

  it("serves from the file cache while the breaker is open, bounded by 600s", async () => {
    const raw = new FakeStore();
    const { handler, file } = setup({ store: withBreaker(raw), flushStore: raw });
    raw.failing = true;
    await handler.get("warmup", fetchGetCtx([])); // opens the breaker
    raw.failing = false;
    const callsBefore = raw.calls;
    file.entries.set("fresh", { lastModified: Date.now(), value: fetchValue("f") });
    file.entries.set("stale", {
      lastModified: Date.now() - 601_000,
      value: fetchValue("s", ["grove-catalog"]),
    });
    file.entries.set("old-blog", {
      lastModified: Date.now() - 3_600_000,
      value: fetchValue("b"),
    });
    const hit = await handler.get("fresh", fetchGetCtx(["grove-product-1"]));
    expect(hit?.value).toEqual(fetchValue("f"));
    expect(await handler.get("stale", fetchGetCtx([]))).toBeNull();
    expect(await handler.get("old-blog", fetchGetCtx(["ghost"]))).not.toBeNull();
    await handler.set("new", fetchValue("n"), fetchSetCtx([]));
    expect(file.calls).toContain("set:new");
    expect(raw.calls).toBe(callsBefore);
  });

  it("non-FETCH Valkey miss falls back to the build's file cache entry", async () => {
    const { handler, file } = setup();
    const prerender = { lastModified: Date.now() - 1000, value: routeValue("_N_T_/sitemap.xml") };
    file.entries.set(ROUTE_KEY, prerender);
    expect(await handler.get(ROUTE_KEY, { kind: "APP_ROUTE" })).toEqual(prerender);
    // A FETCH miss stays a plain miss: fetch entries are shared, not per build.
    file.entries.set("fk", { lastModified: Date.now(), value: fetchValue("disk") });
    expect(await handler.get("fk", fetchGetCtx([]))).toBeNull();
    expect(file.calls).toEqual([`get:${ROUTE_KEY}`]);
  });

  it("a not-ready store falls back to the file cache without logging", async () => {
    const store = new FakeStore();
    store.get = () => Promise.reject(new StoreNotReadyError());
    const { handler, file, log } = setup({ store });
    await expect(handler.get("k1", fetchGetCtx([]))).resolves.toBeNull();
    expect(file.calls).toEqual(["get:k1"]);
    expect(log).not.toHaveBeenCalled();
  });

  it("keeps optimized images in the file cache", async () => {
    const { handler, store, file } = setup();
    await handler.get("img", { kind: "IMAGE" });
    await handler.set("img", { kind: "IMAGE", buffer: Buffer.from("x") }, { kind: "IMAGE" });
    expect(store.calls).toBe(0);
    expect(file.calls).toEqual(["get:img", "set:img"]);
  });

  it("also flushes the local file cache so fallback entries see the flush", async () => {
    const { handler, file } = setup();
    await handler.revalidateTag(["grove-catalog", "grove-product-3"]);
    expect(file.calls).toContain("revalidateTag:grove-catalog,grove-product-3");
  });
});

describe("file-cache mode", () => {
  it("storesFromEnv needs both VALKEY_URL and GROVE_CACHE_NAMESPACE", () => {
    const create = vi.fn(() => new FakeStore());
    expect(storesFromEnv({}, create)).toEqual({ store: null, flushStore: null });
    expect(storesFromEnv({ VALKEY_URL: "redis://x:6379" }, create).store).toBeNull();
    expect(storesFromEnv({ GROVE_CACHE_NAMESPACE: "nursery" }, create).store).toBeNull();
    expect(create).not.toHaveBeenCalled();
    const env = { VALKEY_URL: "redis://x:6379", GROVE_CACHE_NAMESPACE: "n" };
    const both = storesFromEnv(env, create);
    expect(create).toHaveBeenCalledWith("redis://x:6379", "n");
    expect(both.store).not.toBeNull();
    expect(both.flushStore).not.toBe(both.store);
  });

  it("env-unset mode serves a product entry older than 600s from the file cache", async () => {
    const file = fakeFileCache();
    const Handler = createGroveCacheHandler({
      store: null,
      flushStore: null,
      createFileCache: () => file,
      buildId: () => "B",
    });
    const old = {
      lastModified: Date.now() - 3_600_000,
      value: fetchValue("old", ["grove-catalog"]),
    };
    file.entries.set("k1", old);
    const got = await new Handler(CTOR_CTX).get("k1", fetchGetCtx(["grove-product-1"]));
    expect(got).toEqual(old);
  });

  it("delegates to the file cache when VALKEY_URL is unset", async () => {
    vi.stubEnv("VALKEY_URL", "");
    vi.stubEnv("GROVE_CACHE_NAMESPACE", "nursery");
    vi.resetModules();
    fileCacheInstances.length = 0;
    const { default: GroveCacheHandler } = await import("./handler");
    const handler = new GroveCacheHandler(CTOR_CTX);
    await handler.get("k1", fetchGetCtx([]));
    await handler.set("k1", fetchValue("a"), fetchSetCtx([]));
    await handler.revalidateTag("grove-catalog");
    expect(fileCacheInstances).toHaveLength(1);
    expect(fileCacheInstances[0]?.ctx).toBe(CTOR_CTX);
    expect(fileCacheInstances[0]?.calls).toEqual(["get:k1", "set:k1", "revalidateTag"]);
    vi.unstubAllEnvs();
  });
});
