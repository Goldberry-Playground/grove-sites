/**
 * Next.js 15 `cacheHandler` that keeps the Data Cache in Valkey, so every storefront
 * instance shares cached entries and tag flushes.
 *
 * Key layout (the store adds the `grove:<namespace>:` prefix):
 * - `FETCH` entries: `d:<key>`. Fetch keys do not depend on the build.
 * - Other kinds: `b:<BUILD_ID>:<key>`, because page output is build-specific.
 * - Tag flush times: the hash `tags`.
 * Each value is `{ v: 1, lastModified, tags, value }`, stamped with Valkey server time.
 *
 * With `VALKEY_URL` or `GROVE_CACHE_NAMESPACE` unset, every call passes straight through to
 * Next's own file cache, unchanged. While Valkey is unavailable, calls fall back to that file
 * cache too, but product data is then never served older than 600s. A page or route miss in
 * Valkey also checks the file cache, so a fresh deploy can serve its on-disk prerenders.
 *
 * Next loads this file directly (bundled to `dist/handler.js`), so it must not import any
 * workspace package source.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import FileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache";
import { DEFAULT_TTL_SECONDS, maxAgeSeconds } from "./policy";
import { deserialize, serialize } from "./serialize";
import {
  BreakerOpenError,
  type CacheStore,
  createValkeyStore,
  StoreNotReadyError,
  withBreaker,
} from "./store";

/** A Next incremental-cache value (`FETCH`, `APP_PAGE`, `APP_ROUTE`, `IMAGE`, ...). */
export type CacheValue = { kind: string; [field: string]: unknown } | null;

/** What `get` returns to Next. */
export interface CacheHandlerValue {
  lastModified?: number;
  value: CacheValue;
}

/** The constructor `ctx` Next passes (see the Task 0 report). Passed whole to the file cache. */
export interface HandlerContext {
  serverDistDir?: string;
  revalidatedTags?: string[];
  [field: string]: unknown;
}

/** `get` ctx. `FETCH` reads carry `tags` and the implicit `_N_T_` path tags in `softTags`. */
export interface GetContext {
  kind?: string;
  tags?: string[];
  softTags?: string[];
  [field: string]: unknown;
}

/** `set` ctx. `FETCH` writes have `fetchCache: true` and `tags`, but no `kind`. */
export interface SetContext {
  kind?: string;
  fetchCache?: boolean;
  tags?: string[];
  [field: string]: unknown;
}

/** The parts of Next's `FileSystemCache` the handler delegates to. */
export interface FileCache {
  get(key: string, ctx: GetContext): Promise<CacheHandlerValue | null>;
  set(key: string, data: CacheValue, ctx: SetContext): Promise<void>;
  revalidateTag(tags: string | string[]): Promise<void>;
  resetRequestCache?(): void;
}

export interface HandlerDeps {
  /** Store for reads and writes, normally behind the breaker. `null` = file cache only. */
  store: CacheStore | null;
  /** Store for tag flushes. It bypasses the breaker, so a flush is never skipped. */
  flushStore: CacheStore | null;
  createFileCache(ctx: HandlerContext): FileCache;
  /** Build id for non-`FETCH` keys. `null` keeps those entries in the file cache. */
  buildId(ctx: HandlerContext): string | null;
  log?(message: string, err: unknown): void;
}

interface Entry {
  v: 1;
  lastModified: number;
  tags: string[];
  value: CacheValue;
}

const TAGS_HEADER = "x-next-cache-tags";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && t !== "") : [];
}

function union(...lists: Array<readonly string[] | undefined>): string[] {
  return [...new Set(lists.flatMap((l) => strings(l)))];
}

/** Tags stored on a value: `tags` for fetches, the cache-tags header for pages and routes. */
function valueTags(value: CacheValue): string[] {
  if (!value) return [];
  if (value.kind === "FETCH") return strings(value.tags);
  const header = isRecord(value.headers) ? value.headers[TAGS_HEADER] : undefined;
  return typeof header === "string" ? strings(header.split(",")) : [];
}

/** True when product data is past its 600s maximum age. */
function tooOld(tags: string[], lastModified: number): boolean {
  const max = maxAgeSeconds(tags);
  return max !== null && Date.now() - lastModified > max * 1000;
}

/** Any corrupt, truncated or other-version entry parses to `null` (a miss). */
function parseEntry(raw: string): Entry | null {
  let parsed: unknown;
  try {
    parsed = deserialize(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== 1 || !("value" in parsed)) return null;
  const { lastModified, value } = parsed;
  if (typeof lastModified !== "number" || !Number.isFinite(lastModified)) return null;
  if (value !== null && !(isRecord(value) && typeof value.kind === "string")) return null;
  return { v: 1, lastModified, tags: strings(parsed.tags), value: value as CacheValue };
}

/** The cache handler surface Next 15 calls. */
export interface GroveCacheHandlerInstance {
  get(key: string, ctx?: GetContext): Promise<CacheHandlerValue | null>;
  set(key: string, data: CacheValue, ctx?: SetContext): Promise<void>;
  revalidateTag(tags: string | string[]): Promise<void>;
  resetRequestCache(): void;
}

export type GroveCacheHandlerClass = new (ctx: HandlerContext) => GroveCacheHandlerInstance;

/** Builds the handler class over the given stores. The default export wires it from env. */
export function createGroveCacheHandler(deps: HandlerDeps): GroveCacheHandlerClass {
  const { store, flushStore } = deps;

  function report(op: string, err: unknown): void {
    // Expected while Valkey is down or still connecting: not worth a log line per call.
    if (err instanceof BreakerOpenError || err instanceof StoreNotReadyError) return;
    deps.log?.(`${op} failed`, err);
  }

  return class GroveCacheHandler implements GroveCacheHandlerInstance {
    private fileCache: FileCache | null = null;
    private readonly revalidated: string[];

    constructor(private readonly ctx: HandlerContext) {
      this.revalidated = strings(ctx.revalidatedTags);
    }

    private file(): FileCache {
      this.fileCache ??= deps.createFileCache(this.ctx);
      return this.fileCache;
    }

    /** Store key, or `null` when this entry must stay in the file cache. */
    private storeKey(key: string, isFetch: boolean, isImage: boolean): string | null {
      if (!store || isImage) return null;
      if (isFetch) return `d:${key}`;
      const buildId = deps.buildId(this.ctx);
      return buildId ? `b:${buildId}:${key}` : null;
    }

    async get(key: string, ctx: GetContext = {}): Promise<CacheHandlerValue | null> {
      const k = this.storeKey(key, ctx.kind === "FETCH", ctx.kind === "IMAGE");
      if (!store || k === null) return this.fileGet(key, ctx);
      try {
        const raw = await store.get(k);
        // A page or route miss may still be this build's on-disk prerender.
        if (raw === null) return ctx.kind === "FETCH" ? null : this.fileGet(key, ctx);
        const entry = parseEntry(raw);
        if (!entry) return null;
        const tags = union(entry.tags, ctx.tags);
        if (tooOld(tags, entry.lastModified)) return null;
        const checked = union(tags, ctx.softTags);
        if (checked.some((t) => this.revalidated.includes(t))) return null;
        if (checked.length > 0) {
          const times = await store.tagTimes(checked);
          // `>=`, as in Next: a flush in the same millisecond as the write wins.
          if (times.some((t) => t !== null && t >= entry.lastModified)) return null;
        }
        return { lastModified: entry.lastModified, value: entry.value };
      } catch (err) {
        report("get", err);
        return this.fileGet(key, ctx);
      }
    }

    async set(key: string, data: CacheValue, ctx: SetContext = {}): Promise<void> {
      const isFetch = data?.kind === "FETCH" || ctx.fetchCache === true;
      const isImage = data?.kind === "IMAGE" || ctx.kind === "IMAGE";
      const k = this.storeKey(key, isFetch, isImage);
      if (!store || k === null) return this.fileSet(key, data, ctx);
      const tags = union(isFetch ? ctx.tags : [], valueTags(data));
      try {
        const lastModified = await store.now();
        const entry: Entry = { v: 1, lastModified, tags, value: data };
        await store.set(k, serialize(entry), maxAgeSeconds(tags) ?? DEFAULT_TTL_SECONDS);
      } catch (err) {
        report("set", err);
        await this.fileSet(key, data, ctx);
      }
    }

    /**
     * Records the flush in Valkey (bypassing the breaker, bounded by the 150ms command
     * timeout) and in the local file cache. Never throws; a failed flush is logged.
     */
    async revalidateTag(tags: string | string[]): Promise<void> {
      const list = strings([tags].flat());
      try {
        await this.file().revalidateTag(tags);
      } catch (err) {
        report("file revalidateTag", err);
      }
      if (!flushStore || list.length === 0) return;
      try {
        const at = await flushStore.now();
        await flushStore.touchTags(list, at);
      } catch (err) {
        deps.log?.(`revalidateTag failed for ${list.join(",")}`, err);
      }
    }

    resetRequestCache(): void {
      this.fileCache?.resetRequestCache?.();
    }

    /**
     * Reads Next's file cache. With no store configured this is a pure pass-through (today's
     * behaviour). As a fallback for Valkey it also enforces the 600s product-data cap.
     */
    private async fileGet(key: string, ctx: GetContext): Promise<CacheHandlerValue | null> {
      try {
        const hit = await this.file().get(key, ctx);
        if (!store || !hit || typeof hit.lastModified !== "number") return hit;
        return tooOld(union(valueTags(hit.value), ctx.tags), hit.lastModified) ? null : hit;
      } catch (err) {
        report("file get", err);
        return null;
      }
    }

    private async fileSet(key: string, data: CacheValue, ctx: SetContext): Promise<void> {
      try {
        await this.file().set(key, data, ctx);
      } catch (err) {
        report("file set", err);
      }
    }
  };
}

type StoreFactory = (url: string, namespace: string) => CacheStore;

/**
 * Stores for the given env: both `null` unless `VALKEY_URL` and `GROVE_CACHE_NAMESPACE`
 * are set. Reads and writes go through the breaker; flushes use the raw store.
 */
export function storesFromEnv(
  env: Record<string, string | undefined>,
  create: StoreFactory = createValkeyStore,
): Pick<HandlerDeps, "store" | "flushStore"> {
  const url = env.VALKEY_URL;
  const namespace = env.GROVE_CACHE_NAMESPACE;
  if (!url || !namespace) return { store: null, flushStore: null };
  const flushStore = create(url, namespace);
  return { store: withBreaker(flushStore), flushStore };
}

let cachedBuildId: string | null | undefined;

/** Reads `.next/BUILD_ID` once per process. */
function readBuildId(ctx: HandlerContext): string | null {
  if (cachedBuildId !== undefined) return cachedBuildId;
  try {
    const dir = typeof ctx.serverDistDir === "string" ? ctx.serverDistDir : "";
    const id = dir ? readFileSync(path.join(dir, "..", "BUILD_ID"), "utf8").trim() : "";
    cachedBuildId = id || null;
  } catch {
    cachedBuildId = null;
  }
  return cachedBuildId;
}

type FileSystemCacheContext = ConstructorParameters<typeof FileSystemCache>[0];

// Created at module load: Next constructs a handler per request, and the client must be
// connecting before the first command (with no offline queue, early commands fail).
const GroveCacheHandler: GroveCacheHandlerClass = createGroveCacheHandler({
  ...storesFromEnv(process.env),
  createFileCache: (ctx) =>
    new FileSystemCache(ctx as unknown as FileSystemCacheContext) as unknown as FileCache,
  buildId: readBuildId,
  log: (message, err) =>
    console.warn(`[grove-cache] ${message}:`, err instanceof Error ? err.message : err),
});

export default GroveCacheHandler;
