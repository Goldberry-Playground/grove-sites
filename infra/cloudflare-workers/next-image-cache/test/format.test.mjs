// Pure/unit tests for the grove-next-image-cache Worker's cache-key core.
// Runs with zero dependencies:  node --test  (from this directory or repo).
//
// These cover the ONLY correctness-critical, deterministic logic: how an
// `Accept` header is bucketed and how the synthetic cache key is shaped. The
// fetch()/Cache-API glue needs the CF runtime and is verified live at the
// release-train QA window (see README acceptance probe).

import { test } from "node:test";
import assert from "node:assert/strict";

import { pickFormatBucket, CANONICAL_ACCEPT, buildCacheKeyUrl } from "../src/worker.mjs";

test("pickFormatBucket: AVIF wins when accepted (Next negotiation order)", () => {
  assert.equal(pickFormatBucket("image/avif,image/webp,image/apng,*/*;q=0.8"), "avif");
  // AVIF takes precedence over WebP when both are present.
  assert.equal(pickFormatBucket("image/webp,image/avif"), "avif");
});

test("pickFormatBucket: WebP when accepted and AVIF is not", () => {
  assert.equal(pickFormatBucket("image/webp,image/apng,*/*;q=0.8"), "webp");
});

test("pickFormatBucket: original for JPEG-only / wildcard / empty / missing", () => {
  assert.equal(pickFormatBucket("image/jpeg,image/png,*/*"), "orig");
  assert.equal(pickFormatBucket("*/*"), "orig");
  assert.equal(pickFormatBucket(""), "orig");
  assert.equal(pickFormatBucket(null), "orig");
  assert.equal(pickFormatBucket(undefined), "orig");
});

test("pickFormatBucket: case-insensitive", () => {
  assert.equal(pickFormatBucket("IMAGE/AVIF,*/*"), "avif");
  assert.equal(pickFormatBucket("Image/WebP"), "webp");
});

test("CANONICAL_ACCEPT round-trips through pickFormatBucket (origin returns the intended bucket)", () => {
  for (const bucket of ["avif", "webp", "orig"]) {
    assert.equal(
      pickFormatBucket(CANONICAL_ACCEPT[bucket]),
      bucket,
      `canonical Accept for ${bucket} must negotiate back to ${bucket}`,
    );
  }
});

test("buildCacheKeyUrl: never matches the /_next/image* bypass Cache Rule", () => {
  const url = "https://atthegrovenursery.com/_next/image?url=%2Fp.jpg&w=640&q=75";
  for (const bucket of ["avif", "webp", "orig"]) {
    const key = new URL(buildCacheKeyUrl(url, bucket));
    assert.ok(
      !key.pathname.startsWith("/_next/image"),
      `key path for ${bucket} must not start_with /_next/image (would be bypassed): ${key.pathname}`,
    );
    assert.ok(key.pathname.startsWith(`/__grove-img-cache/${bucket}/`), key.pathname);
  }
});

test("buildCacheKeyUrl: preserves original query and keys distinctly per bucket", () => {
  const url = "https://atthegrovenursery.com/_next/image?url=%2Fp.jpg&w=640&q=75";
  const avif = buildCacheKeyUrl(url, "avif");
  const webp = buildCacheKeyUrl(url, "webp");
  const orig = buildCacheKeyUrl(url, "orig");

  // Distinct per bucket — this is what prevents cross-format poisoning.
  assert.notEqual(avif, webp);
  assert.notEqual(webp, orig);
  assert.notEqual(avif, orig);

  // Original path + query survive so different variants (w/q/url) stay distinct.
  const k = new URL(avif);
  assert.equal(k.searchParams.get("url"), "/p.jpg");
  assert.equal(k.searchParams.get("w"), "640");
  assert.equal(k.searchParams.get("q"), "75");
  assert.ok(k.pathname.endsWith("/_next/image"));
});

test("buildCacheKeyUrl: deterministic for identical (url, bucket)", () => {
  const url = "https://atthegrovenursery.com/_next/image?url=%2Fp.jpg&w=828&q=75";
  assert.equal(buildCacheKeyUrl(url, "avif"), buildCacheKeyUrl(url, "avif"));
});

test("buildCacheKeyUrl: distinct image variants (w/q) produce distinct keys", () => {
  const base = "https://atthegrovenursery.com/_next/image?url=%2Fp.jpg";
  assert.notEqual(buildCacheKeyUrl(`${base}&w=640&q=75`, "avif"), buildCacheKeyUrl(`${base}&w=828&q=75`, "avif"));
});
