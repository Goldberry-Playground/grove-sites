// Glue tests for the Worker fetch handler against an in-memory Cache API +
// a content-negotiating fake origin. Proves the GOL-2073 acceptance property
// offline: one shared /_next/image URL probed with AVIF / WebP / JPEG Accept
// returns each client its OWN format, MISS then HIT per format, never another
// bucket's bytes (the GOL-885 poisoning regression). The live CF probe at the
// release-train window (README) is the final gate.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import worker from "../src/worker.mjs";

const URL_ = "https://atthegrovenursery.com/_next/image?url=%2Fp.jpg&w=640&q=75";

let store;
let originCalls;
let originImpl;

// Mirrors Next's negotiation: first configured format the client accepts.
function negotiatingOrigin(input, init) {
  const accept = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get("Accept") || "";
  const type = accept.includes("image/avif") ? "image/avif" : accept.includes("image/webp") ? "image/webp" : "image/jpeg";
  return new Response(`bytes:${type}`, {
    status: 200,
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000", "CDN-Cache-Control": "no-store", Vary: "Accept" },
  });
}

beforeEach(() => {
  store = new Map();
  originCalls = [];
  originImpl = negotiatingOrigin;
  globalThis.caches = {
    default: {
      async match(req) {
        const r = store.get(req.url);
        return r ? r.clone() : undefined;
      },
      async put(req, resp) {
        store.set(req.url, resp.clone());
      },
    },
  };
  globalThis.fetch = async (input, init) => {
    originCalls.push({ input, init });
    return originImpl(input, init);
  };
});

async function probe(accept, method = "GET") {
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  const resp = await worker.fetch(new Request(URL_, { method, headers: { Accept: accept } }), {}, ctx);
  await Promise.all(pending);
  return resp;
}

const PROBES = [
  ["image/avif,image/webp,*/*", "image/avif"],
  ["image/webp,*/*", "image/webp"],
  ["image/jpeg", "image/jpeg"],
];

test("acceptance: 3 Accept variants of ONE URL each get their own format, MISS then HIT", async () => {
  for (const [accept, type] of PROBES) {
    const miss = await probe(accept);
    assert.equal(miss.headers.get("Content-Type"), type);
    assert.equal(miss.headers.get("x-grove-img-cache"), "MISS");
    assert.equal(await miss.text(), `bytes:${type}`);
  }
  for (const [accept, type] of PROBES) {
    const hit = await probe(accept);
    assert.equal(hit.headers.get("Content-Type"), type, `GOL-885 REGRESSION: ${accept} got ${hit.headers.get("Content-Type")}`);
    assert.equal(hit.headers.get("x-grove-img-cache"), "HIT");
    assert.equal(await hit.text(), `bytes:${type}`);
  }
  assert.equal(originCalls.length, 3, "one origin round-trip per format, then edge hits");
  assert.equal(store.size, 3);
});

test("a warm AVIF entry is never served to a JPEG-only client (poisoning guard)", async () => {
  await probe("image/avif,*/*");
  await probe("image/avif,*/*");
  const jpeg = await probe("image/jpeg,image/png");
  assert.equal(jpeg.headers.get("Content-Type"), "image/jpeg");
  assert.equal(jpeg.headers.get("x-grove-img-cache"), "MISS");
});

test("client-facing headers are the origin's (no-store guard intact), edge TTL only on stored copy", async () => {
  await probe("image/webp");
  const hit = await probe("image/webp");
  assert.equal(hit.headers.get("Cache-Control"), "public, max-age=31536000");
  assert.equal(hit.headers.get("x-grove-origin-cc"), null);
  assert.equal(hit.headers.get("Vary"), "Accept");
  const stored = [...store.values()][0];
  assert.match(stored.headers.get("Cache-Control"), /^public, max-age=\d+$/);
  assert.equal(stored.headers.get("CDN-Cache-Control"), null);
});

test("origin is asked with the bucket's canonical Accept, not the raw client string", async () => {
  await probe("text/html,image/avif;q=0.9,*/*;q=0.8");
  assert.equal(new Headers(originCalls[0].init.headers).get("Accept"), "image/avif,image/webp,image/*,*/*;q=0.8");
});

test("origin fetch bypasses CF's Accept-blind automatic cache (independent of Rule 1b)", async () => {
  await probe("image/webp");
  assert.equal(originCalls[0].init.cache, "no-store");
});

test("errors and non-image responses are never cached", async () => {
  originImpl = () => new Response("nope", { status: 400, headers: { "Content-Type": "text/plain" } });
  const r1 = await probe("image/avif");
  assert.equal(r1.status, 400);
  originImpl = () => new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } });
  await probe("image/avif");
  assert.equal(store.size, 0);
});

test("fail open: a Cache API fault passes through to origin instead of erroring", async () => {
  globalThis.caches.default.match = async () => {
    throw new Error("cache down");
  };
  const r = await probe("image/avif");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), "image/avif");
});

test("non-GET/HEAD passes straight through uncached", async () => {
  const pending = [];
  const r = await worker.fetch(new Request(URL_, { method: "POST", body: "x" }), {}, { waitUntil: (p) => pending.push(p) });
  assert.equal(r.status, 200);
  assert.equal(store.size, 0);
});
