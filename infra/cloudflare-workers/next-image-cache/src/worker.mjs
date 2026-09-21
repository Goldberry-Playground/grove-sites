// grove-next-image-cache — Accept-keyed edge cache for Next.js /_next/image on
// Cloudflare FREE-tier zones (GOL-2073, follow-on to GOL-1874).
//
// WHY A WORKER AND NOT A CACHE RULE
// ---------------------------------
// /_next/image content-negotiates its output format on the request `Accept`
// header (AVIF -> WebP -> original; verified: all four apps set
// images.formats = ["image/avif","image/webp"] in next.config.ts) and emits
// `Vary: Accept`. Cloudflare's shared edge cache does NOT honor `Vary: Accept`,
// so caching /_next/image under an Accept-blind key serves the first client's
// AVIF bytes to a JPEG-only client for the whole TTL — the exact bug GOL-885 /
// GOL-873 fixed by BYPASSING the edge for this path.
//
// A Custom Cache Key that includes a request header (`Accept`) is Cloudflare
// ENTERPRISE-only; every Grove zone is on the FREE plan (confirmed 2026-09-04,
// `cache/variants` API err 1135). So the only safe way to edge-cache this path
// on Free is a Worker that folds a normalized `Accept` bucket into its own
// synthetic Cache API key. Each format bucket gets its own cache entry, so a
// bucket's bytes are only ever served to clients in that bucket — no poisoning.
//
// INTERACTION WITH THE EXISTING GOL-873 BYPASS (cache-rules.tf Rule 1b)
// --------------------------------------------------------------------
// Rule 1b sets `cache=false` on /_next/image*, keeping Cloudflare's AUTOMATIC
// cache off the path (the poisoning guard stays). This Worker never caches the
// real /_next/image URL: its synthetic key is re-rooted under
// /__grove-img-cache/<bucket>/... — a path that never `starts_with`
// "/_next/image", so no bypass Cache Rule matches it and `cache.put()` actually
// stores. The origin subrequest still hits /_next/image (Rule 1b keeps it out of
// the shared auto-cache) AND the Worker fetches it with `cache: "no-store"`, so
// every Worker MISS reaches origin fresh even if Rule 1b is absent (it is not in
// prod state as of 2026-09-21) and every HIT is served from the edge.
//
// BROWSER CACHING IS LEFT UNTOUCHED
// ---------------------------------
// The Worker owns the EDGE TTL only. The client-facing `Cache-Control` is
// preserved exactly as the origin sends it (GOL-885 deliberately emits
// `cdn-cache-control: no-store`); we stash the origin value on the stored copy
// and restore it on a HIT. Ada's app-side CDN-Cache-Control flip (GOL-1874 perf
// child) changes browser/private caching independently and is NOT a prerequisite
// for this edge fix.

// --- Pure, unit-tested core (exported for test/format.test.mjs) --------------

/**
 * Map a request `Accept` header to a format bucket, mirroring Next.js
 * getSupportedMimeType() with images.formats = ["image/avif","image/webp"].
 * Next iterates the configured formats in order and returns the first the
 * client accepts; otherwise it serves the original format.
 */
export function pickFormatBucket(acceptHeader) {
  const accept = (acceptHeader || "").toLowerCase();
  if (accept.includes("image/avif")) return "avif";
  if (accept.includes("image/webp")) return "webp";
  return "orig";
}

/**
 * Canonical `Accept` the Worker sends to origin per bucket. Forcing a canonical
 * value makes the origin negotiate EXACTLY the bucket's format regardless of the
 * client's precise Accept string, so the cached bytes always match the key.
 * Round-trip invariant: pickFormatBucket(CANONICAL_ACCEPT[b]) === b.
 */
export const CANONICAL_ACCEPT = {
  avif: "image/avif,image/webp,image/*,*/*;q=0.8",
  webp: "image/webp,image/*,*/*;q=0.8",
  orig: "image/jpeg,image/png,image/*,*/*;q=0.8",
};

/**
 * Build the synthetic Cache API key URL. Re-roots the path under
 * /__grove-img-cache/<bucket> so it never matches the /_next/image* bypass Cache
 * Rule (which would make cache.put a no-op) and so each format bucket is a
 * distinct cache entry. Original path + query are preserved for uniqueness.
 */
export function buildCacheKeyUrl(requestUrl, bucket) {
  const u = new URL(requestUrl);
  u.pathname = `/__grove-img-cache/${bucket}${u.pathname}`;
  return u.toString();
}

const ORIGIN_CC_STASH = "x-grove-origin-cc";
const DEFAULT_EDGE_TTL = 86400; // 1 day; product photos are effectively immutable per (url,w,q)

// --- Worker entrypoint -------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    // Only GET/HEAD are cacheable image reads; everything else passes through.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return fetch(request);
    }
    // FAIL OPEN: any Worker/Cache-API fault must degrade to a plain origin
    // pass-through (today's behavior), never a CF 1101 error = broken photo.
    try {
      return await handleImage(request, env, ctx);
    } catch (err) {
      console.error("grove-next-image-cache: fail-open pass-through", err);
      return fetch(request);
    }
  },
};

async function handleImage(request, env, ctx) {
  const bucket = pickFormatBucket(request.headers.get("Accept"));
  const cache = caches.default;
  const cacheKey = new Request(buildCacheKeyUrl(request.url, bucket), { method: "GET" });

  // Serve from edge if we have this bucket's bytes.
  const hit = await cache.match(cacheKey);
  if (hit) {
    const r = new Response(hit.body, hit);
    // Restore the origin's client-facing Cache-Control (GOL-885 no-store stays
    // intact toward the browser); the Worker only owned the EDGE TTL.
    const savedCC = r.headers.get(ORIGIN_CC_STASH);
    if (savedCC !== null) {
      r.headers.delete(ORIGIN_CC_STASH);
      if (savedCC === "") r.headers.delete("Cache-Control");
      else r.headers.set("Cache-Control", savedCC);
    }
    r.headers.set("x-grove-img-cache", "HIT");
    r.headers.set("x-grove-img-fmt", bucket);
    if (!r.headers.has("Vary")) r.headers.set("Vary", "Accept");
    return r;
  }

  // MISS — fetch origin with the canonical Accept for this bucket so the bytes
  // match the key. `cache: "no-store"` makes this subrequest bypass CF's
  // Accept-blind AUTOMATIC cache on its own, so correctness does NOT depend on
  // cache-rules.tf Rule 1b being applied or on origin keeping CDN-Cache-Control
  // no-store (GOL-2073 found Rule 1b absent from prod state; Ada's header flip
  // must not be able to poison the Worker's origin fetch).
  const originHeaders = new Headers(request.headers);
  originHeaders.set("Accept", CANONICAL_ACCEPT[bucket]);
  const originResp = await fetch(request.url, {
    method: "GET",
    headers: originHeaders,
    cache: "no-store",
  });

  const clientResp = new Response(originResp.body, originResp);
  clientResp.headers.set("x-grove-img-cache", "MISS");
  clientResp.headers.set("x-grove-img-fmt", bucket);
  if (!clientResp.headers.has("Vary")) clientResp.headers.set("Vary", "Accept");

  // Only cache real image successes; never cache errors/redirects/HTML.
  const contentType = originResp.headers.get("Content-Type") || "";
  const cacheable = originResp.status === 200 && contentType.startsWith("image/");
  if (cacheable) {
    const ttl = Number(env && env.EDGE_TTL_SECONDS) || DEFAULT_EDGE_TTL;
    const toStore = clientResp.clone();
    // Stash the origin Cache-Control so a HIT can replay it verbatim; the
    // stored copy's own Cache-Control is what the Worker uses for edge TTL,
    // which lets the edge cache work even while origin says no-store.
    toStore.headers.set(ORIGIN_CC_STASH, clientResp.headers.get("Cache-Control") || "");
    toStore.headers.set("Cache-Control", `public, max-age=${ttl}`);
    toStore.headers.delete("CDN-Cache-Control");
    toStore.headers.delete("Set-Cookie");
    // The bucketed key already partitions by format; a stored `Vary` only adds
    // Cache-API match semantics we don't want. Clients still get Vary: Accept.
    toStore.headers.delete("Vary");
    ctx.waitUntil(cache.put(cacheKey, toStore));
  }

  return clientResp;
}
