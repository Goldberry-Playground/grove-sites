import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BreakerOpenError,
  type CacheStore,
  createValkeyStoreFromClient,
  StoreNotReadyError,
  type ValkeyClientLike,
  withBreaker,
} from "./store";

/** In-memory stand-in for an iovalkey client. Several stores may share one. */
class FakeClient implements ValkeyClientLike {
  status = "ready";
  kv = new Map<string, { value: string; ttl: number }>();
  hashes = new Map<string, Map<string, string>>();
  serverMs = 1_700_000_000_123;
  private readyListeners: Array<() => void> = [];

  once(event: "ready", listener: () => void): this {
    if (event === "ready") this.readyListeners.push(listener);
    return this;
  }
  becomeReady(): void {
    this.status = "ready";
    for (const l of this.readyListeners.splice(0)) l();
  }
  async get(key: string): Promise<string | null> {
    return this.kv.get(key)?.value ?? null;
  }
  async set(
    key: string,
    value: string,
    _ex: "EX",
    ttl: number,
    nx?: "NX",
  ): Promise<"OK" | null> {
    if (nx && this.kv.has(key)) return null;
    this.kv.set(key, { value, ttl });
    return "OK";
  }
  async hmget(key: string, ...fields: string[]): Promise<Array<string | null>> {
    const h = this.hashes.get(key);
    return fields.map((f) => h?.get(f) ?? null);
  }
  async hset(key: string, values: Record<string, string>): Promise<number> {
    const h = this.hashes.get(key) ?? new Map<string, string>();
    for (const [f, v] of Object.entries(values)) h.set(f, v);
    this.hashes.set(key, h);
    return Object.keys(values).length;
  }
  async time(): Promise<[string, string]> {
    const s = Math.floor(this.serverMs / 1000);
    const us = (this.serverMs % 1000) * 1000 + 456;
    return [String(s), String(us)];
  }
}

describe("createValkeyStoreFromClient", () => {
  it("namespaces keys: same key under two namespaces does not collide", async () => {
    const client = new FakeClient();
    const a = createValkeyStoreFromClient(client, "nursery");
    const b = createValkeyStoreFromClient(client, "goldberry");
    await a.set("d:k", "from-a", 600);
    expect(await a.get("d:k")).toBe("from-a");
    expect(await b.get("d:k")).toBeNull();
    expect([...client.kv.keys()]).toEqual(["grove:nursery:d:k"]);
    expect(client.kv.get("grove:nursery:d:k")?.ttl).toBe(600);
  });

  it("keeps tag times in the namespace's tags hash", async () => {
    const client = new FakeClient();
    const a = createValkeyStoreFromClient(client, "nursery");
    const b = createValkeyStoreFromClient(client, "goldberry");
    await a.touchTags(["grove-catalog", "_N_T_/shop"], 1234);
    expect(await a.tagTimes(["grove-catalog", "x", "_N_T_/shop"])).toEqual([1234, null, 1234]);
    expect(await b.tagTimes(["grove-catalog"])).toEqual([null]);
    expect(client.hashes.has("grove:nursery:tags")).toBe(true);
  });

  it("reads time from the server, in milliseconds", async () => {
    const client = new FakeClient();
    const store = createValkeyStoreFromClient(client, "n");
    expect(await store.now()).toBe(1_700_000_000_123);
  });

  it("acquires a lock only once until it expires", async () => {
    const client = new FakeClient();
    const store = createValkeyStoreFromClient(client, "n");
    expect(await store.acquireLock("warm", 270)).toBe(true);
    expect(await store.acquireLock("warm", 270)).toBe(false);
    expect(client.kv.get("grove:n:lock:warm")?.ttl).toBe(270);
  });

  describe("before the first connect", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("waits for the first ready event, once", async () => {
      const client = new FakeClient();
      client.status = "connecting";
      const store = createValkeyStoreFromClient(client, "n");
      const pending = store.get("d:k");
      await vi.advanceTimersByTimeAsync(20);
      client.becomeReady();
      await expect(pending).resolves.toBeNull();
    });

    it("rejects as not-ready after about 500ms, then fails fast", async () => {
      const client = new FakeClient();
      client.status = "connecting";
      const store = createValkeyStoreFromClient(client, "n");
      const first = store.get("d:k");
      const firstSettled = expect(first).rejects.toBeInstanceOf(StoreNotReadyError);
      await vi.advanceTimersByTimeAsync(499);
      await vi.advanceTimersByTimeAsync(1);
      await firstSettled;
      // The wait happens once: later calls do not wait again.
      await expect(store.get("d:k")).rejects.toBeInstanceOf(StoreNotReadyError);
    });

    it("a not-ready store does not open the breaker", async () => {
      const client = new FakeClient();
      client.status = "connecting";
      const raw = createValkeyStoreFromClient(client, "n", { firstReadyCapMs: 0 });
      const store = withBreaker(raw);
      const first = expect(store.get("d:k")).rejects.toBeInstanceOf(StoreNotReadyError);
      await vi.advanceTimersByTimeAsync(1);
      await first;
      client.becomeReady();
      client.kv.set("grove:n:d:k", { value: "v", ttl: 1 });
      await expect(store.get("d:k")).resolves.toBe("v");
    });
  });
});

/** A CacheStore whose every call can be made to reject. */
function flakyStore(): CacheStore & { calls: number; failing: boolean } {
  const s = {
    calls: 0,
    failing: true,
    async get(): Promise<string | null> {
      s.calls++;
      if (s.failing) throw new Error("timeout");
      return "hit";
    },
    async set(): Promise<void> {
      s.calls++;
      if (s.failing) throw new Error("timeout");
    },
    async tagTimes(tags: string[]): Promise<Array<number | null>> {
      s.calls++;
      if (s.failing) throw new Error("timeout");
      return tags.map(() => null);
    },
    async touchTags(): Promise<void> {
      s.calls++;
      if (s.failing) throw new Error("timeout");
    },
    async acquireLock(): Promise<boolean> {
      s.calls++;
      if (s.failing) throw new Error("timeout");
      return true;
    },
    async now(): Promise<number> {
      s.calls++;
      if (s.failing) throw new Error("timeout");
      return Date.now();
    },
  };
  return s;
}

describe("withBreaker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("breaker skips the store for openMs after a failure, then retries", async () => {
    const inner = flakyStore();
    const store = withBreaker(inner);
    await expect(store.get("k")).rejects.toThrow("timeout");
    expect(inner.calls).toBe(1);

    // Open: every gated method fails fast without touching the store.
    await expect(store.get("k")).rejects.toBeInstanceOf(BreakerOpenError);
    await expect(store.set("k", "v", 1)).rejects.toBeInstanceOf(BreakerOpenError);
    await expect(store.tagTimes(["t"])).rejects.toBeInstanceOf(BreakerOpenError);
    await expect(store.acquireLock("warm", 1)).rejects.toBeInstanceOf(BreakerOpenError);
    await expect(store.now()).rejects.toBeInstanceOf(BreakerOpenError);
    vi.advanceTimersByTime(9_999);
    await expect(store.get("k")).rejects.toBeInstanceOf(BreakerOpenError);
    expect(inner.calls).toBe(1);

    vi.advanceTimersByTime(1);
    inner.failing = false;
    await expect(store.get("k")).resolves.toBe("hit");
    expect(inner.calls).toBe(2);
  });

  it("honours a custom openMs and re-opens on a failed retry", async () => {
    const inner = flakyStore();
    const store = withBreaker(inner, { openMs: 100 });
    await expect(store.get("k")).rejects.toThrow("timeout");
    vi.advanceTimersByTime(100);
    await expect(store.get("k")).rejects.toThrow("timeout");
    expect(inner.calls).toBe(2);
    vi.advanceTimersByTime(99);
    await expect(store.get("k")).rejects.toBeInstanceOf(BreakerOpenError);
  });
});
