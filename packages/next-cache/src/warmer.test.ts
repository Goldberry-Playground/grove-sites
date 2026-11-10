import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CacheStore } from "./store";
import { collectPaths, startCatalogWarmer, startWarmer, warmOnce, type WarmDeps } from "./warmer";

function fakeStore(lockFree = true): CacheStore & { lockCalls: Array<[string, number]> } {
  const lockCalls: Array<[string, number]> = [];
  return {
    lockCalls,
    get: async () => null,
    set: async () => {},
    tagTimes: async (tags) => tags.map(() => null),
    touchTags: async () => {},
    acquireLock: async (name, ttl) => {
      lockCalls.push([name, ttl]);
      return lockFree;
    },
    now: async () => Date.now(),
  };
}

function deps(over: Partial<WarmDeps> = {}): WarmDeps {
  return {
    store: fakeStore(),
    listPaths: async () => ["/shop/a", "/shop/b", "/shop/c"],
    fetchPath: async () => ({ status: 200 }),
    gapMs: 0,
    ...over,
  };
}

describe("warmOnce", () => {
  it("requests every listed path", async () => {
    const fetchPath = vi.fn(async (_path: string) => ({ status: 200 }));
    const store = fakeStore();
    const result = await warmOnce(deps({ fetchPath, store }));
    expect(fetchPath.mock.calls.map((c) => c[0]).sort()).toEqual([
      "/shop/a",
      "/shop/b",
      "/shop/c",
    ]);
    expect(result).toEqual({ warmed: 3, failed: 0, skipped: false });
    expect(store.lockCalls).toEqual([["warm", 270]]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const fetchPath = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { status: 200 };
    };
    const paths = Array.from({ length: 9 }, (_, i) => `/shop/${i}`);
    await warmOnce(deps({ fetchPath, listPaths: async () => paths, concurrency: 2 }));
    expect(peak).toBe(2);
  });

  it("skips the cycle when the lock is held", async () => {
    const fetchPath = vi.fn(async () => ({ status: 200 }));
    const result = await warmOnce(deps({ fetchPath, store: fakeStore(false) }));
    expect(result.skipped).toBe(true);
    expect(fetchPath).not.toHaveBeenCalled();
  });

  it("counts a 404 and continues", async () => {
    const fetchPath = vi.fn(async (p: string) => ({ status: p === "/shop/b" ? 404 : 200 }));
    const result = await warmOnce(deps({ fetchPath }));
    expect(fetchPath).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ warmed: 2, failed: 1, skipped: false });
  });

  it("counts a thrown fetch as failed and continues", async () => {
    const fetchPath = vi.fn(async (p: string) => {
      if (p === "/shop/a") throw new Error("boom");
      return { status: 200 };
    });
    const result = await warmOnce(deps({ fetchPath }));
    expect(result).toEqual({ warmed: 2, failed: 1, skipped: false });
  });

  it("resolves when listPaths rejects", async () => {
    const result = await warmOnce(
      deps({
        listPaths: async () => {
          throw new Error("odoo down");
        },
      }),
    );
    expect(result).toEqual({ warmed: 0, failed: 0, skipped: false });
  });

  it("resolves as skipped when the lock call rejects", async () => {
    const store = fakeStore();
    store.acquireLock = async () => {
      throw new Error("valkey down");
    };
    const result = await warmOnce(deps({ store }));
    expect(result.skipped).toBe(true);
  });
});

describe("startWarmer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("warms after the start delay, then every interval, and stops", async () => {
    const fetchPath = vi.fn(async () => ({ status: 200 }));
    const stop = startWarmer(deps({ fetchPath, listPaths: async () => ["/shop/a"] }), {
      startDelayMs: 1000,
      intervalMs: 5000,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchPath).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchPath).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchPath).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchPath).toHaveBeenCalledTimes(2);
  });
});

describe("startCatalogWarmer", () => {
  it("does not start without VALKEY_URL", () => {
    const stop = startCatalogWarmer(
      { listPaths: async () => [] },
      { GROVE_CACHE_NAMESPACE: "nursery", PORT: "3001" },
    );
    expect(stop).toBeNull();
  });

  it("does not start without GROVE_CACHE_NAMESPACE", () => {
    const stop = startCatalogWarmer(
      { listPaths: async () => [] },
      { VALKEY_URL: "redis://localhost:6379", PORT: "3001" },
    );
    expect(stop).toBeNull();
  });
});

describe("collectPaths", () => {
  it("pages until count is exhausted and skips null paths", async () => {
    const all = [1, 2, 3, 4, 5];
    const offsets: number[] = [];
    const paths = await collectPaths(
      async (offset, limit) => {
        offsets.push(offset);
        return { count: all.length, items: all.slice(offset, offset + limit) };
      },
      (n) => (n === 3 ? null : `/shop/${n}`),
      2,
    );
    expect(offsets).toEqual([0, 2, 4]);
    expect(paths).toEqual(["/shop/1", "/shop/2", "/shop/4", "/shop/5"]);
  });

  it("stops on an empty page", async () => {
    const paths = await collectPaths(async () => ({ count: 10, items: [] }), () => "/x");
    expect(paths).toEqual([]);
  });
});
