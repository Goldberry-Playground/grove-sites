# Storefront Shared Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every storefront product view fast and consistent across instances and deploys, using one shared Valkey data cache, a cache warmer, and faster, better-signalled Odoo reads.

**Architecture:** A custom Next.js `cacheHandler` stores the Data Cache in Valkey and shares tag flushes, and it falls back to Next's own file cache when `VALKEY_URL` is unset. Each storefront refreshes its catalog about every 5 minutes by requesting its own pages. Odoo adds price to its existing change signal and gets a profiled speed-up of the product detail read.

**Tech Stack:** Next.js 15.5 App Router, TypeScript, Vitest, `iovalkey`, esbuild; Odoo 19 Python; Terraform (DigitalOcean provider).

**Spec:** `docs/superpowers/specs/2026-11-09-storefront-shared-cache-design.md`

## Global Constraints

- Three PRs, one per repo: `grove-sites`, `grove-odoo-modules` (from `origin/main`, local checkout is stale), `odoocker-goldberrygrove` (from `origin/main`, local checkout is a stale branch; never PR upstream).
- Checkout, cart quote and promo reads stay live. They never pass `freshness: "display"`.
- Only anonymous catalog reads are cached. Tenants never share a cache key.
- Product-data entries (`grove-product-*`, `grove-catalog` tags) have a hard maximum age of 600 seconds.
- Warming runs about every 300 seconds.
- Valkey: one node, `db-s-1vcpu-1gb`, $15/month, `nyc3`.
- `VALKEY_URL` unset means today's behaviour exactly.
- No Cloudflare changes. No full-page caching. Do not remove `headers()` from layouts.
- Never print secret values. Production Terraform applies are `-target`ed.
- Line length 100, TypeScript strict, no `any`. Run Vitest from the `grove-sites` repo root; run `pnpm --filter @grove/ui-kit build` first in a fresh worktree.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. Valkey hangs rather than refuses connections: each operation gives up within 150ms and later reads skip Valkey for 10s (Task 2).
2. A corrupt, truncated or old-format entry in Valkey: treated as a miss, never a 500 (Task 2).
3. A flush attempted during an outage: never throws into the webhook, and the stale entry is still bounded by the 600s maximum age (Task 2).
4. Two instances starting together: only one warms per cycle (Task 4).
5. A product unpublished between listing and warming: its 404 is skipped and the cycle continues (Task 4).

---

## Part 0: Prove it

### Task 0: Throwaway spike, and a stop gate

**Files:** scratchpad only. Nothing from this task is committed.

- [ ] **Step 1:** Start a local Valkey container and write a minimal handler using the Task 2 interface against a production build of `apps/goldberry`, with a mock Odoo.
- [ ] **Step 2:** Run two `next start` instances on different ports. Call a test route running `revalidateTag` on instance A. Expected: instance B's next read goes to Odoo.
- [ ] **Step 3:** Call `revalidatePath("/shop")` on A. Expected: B's `/shop` read refetches, which proves implicit `_N_T_` path tags reach the handler. Record the exact `ctx` shape `get` receives (`tags`, `softTags`).
- [ ] **Step 4:** Rebuild and restart. Expected: `FETCH` entries are still hit, proving fetch keys do not depend on the build.
- [ ] **Step 5:** Confirm that `next/dist/server/lib/incremental-cache/file-system-cache` can be subclassed or delegated to on 15.5, and that the handler loads in `output: "standalone"`.
- [ ] **Step 6:** Point the handler at a non-routable address and at a closed port, and confirm requests still succeed.
- [ ] **Step 7: Stop gate.** Report results to Josh. If Step 2 or 3 fails, stop: the design's fallback (the webhook calling every instance directly, or shorter windows) needs his decision.

---

## Part 1: `grove-sites` PR

### Task 1: Land the product-page fix and tag the catalog

The uncommitted `fix/pdp-cached-product-reads` work is the base of this PR.

**Files:**
- Modify: `packages/odoo-client/src/client.ts` (list at about line 246, slug lookup, `nav`)
- Modify: `packages/checkout/src/api/createPublishWebhookRoute.ts`
- Modify: `apps/goldberry/app/shop/page.tsx` (stale comment only, if Step 3 confirms)
- Test: `packages/odoo-client/src/product-freshness.test.ts`, `packages/checkout/src/api/createPublishWebhookRoute.test.ts`

**Interfaces:**
- Produces: `PRODUCT_CATALOG_CACHE_TAG = "grove-catalog"` exported from `@grove/odoo-client`.

- [ ] **Step 1: Write failing tests**
  - `list() caches 30s under the catalog tag`: `expect(initOf(0).next).toEqual({ revalidate: 30, tags: [PRODUCT_CATALOG_CACHE_TAG] })`.
  - `display getBySlug tags the slug lookup`: first call's `next.tags` contains `PRODUCT_CATALOG_CACHE_TAG`.
  - `webhook flushes the catalog tag`: `revalidateByTag` called with both `productCacheTag(id)` and `PRODUCT_CATALOG_CACHE_TAG`.
- [ ] **Step 2:** Run `pnpm vitest run packages/odoo-client packages/checkout`. Expected: the three new tests FAIL.
- [ ] **Step 3:** Add the tag to the list and slug fetches and the flush to the webhook. Then confirm on a local production build that Goldberry `/shop` makes at most one Odoo list call in 30s. The explicit `next.revalidate: 30` should already be honoured under `force-dynamic` (proved for GOL-3344), and the 0.18-0.27s live timing agrees. If so, correct the stale comments in the client and page and keep `force-dynamic`. If not, change the page's rendering mode so the list is cached.
- [ ] **Step 4:** Run the same Vitest command. Expected: PASS.
- [ ] **Step 5:** Commit all branch work plus this: `fix(storefront): cache product display reads and tag the catalog`.

### Task 2: `@grove/next-cache` Valkey handler

**Files:**
- Create: `packages/next-cache/package.json`, `tsconfig.json`, `src/handler.ts`, `src/store.ts`, `src/policy.ts`
- Test: `packages/next-cache/src/handler.test.ts`, `src/policy.test.ts`

**Interfaces:**
- Consumes: exact `ctx` shape recorded in Task 0.
- Produces:
  - Default export `class GroveCacheHandler` implementing Next 15's `get(key, ctx)`, `set(key, data, ctx)`, `revalidateTag(tags)`, `resetRequestCache()`.
  - `interface CacheStore { get(k: string): Promise<string | null>; set(k: string, v: string, ttlSeconds: number): Promise<void>; tagTimes(tags: string[]): Promise<Array<number | null>>; touchTags(tags: string[], at: number): Promise<void>; acquireLock(name: string, ttlSeconds: number): Promise<boolean>; }`
  - `createValkeyStore(url: string, namespace: string): CacheStore`, using `iovalkey` with `commandTimeout: 150`, `connectTimeout: 1000`, `maxRetriesPerRequest: 0`, `enableOfflineQueue: false`.
  - `withBreaker(store: CacheStore, opts?: { openMs?: number }): CacheStore`, default `openMs: 10000`.
  - `maxAgeSeconds(tags: string[]): number | null` in `policy.ts`, returning `600` for product data and `null` otherwise.
- Env: `VALKEY_URL`, `GROVE_CACHE_NAMESPACE`. If either is unset, the handler delegates every call to Next's file cache.

Key layout: `grove:<namespace>:d:<key>` for `FETCH` entries; `grove:<namespace>:b:<BUILD_ID>:<key>` for other kinds, where `BUILD_ID` is read once from `.next/BUILD_ID`, because page output is build-specific. Tag times live in the hash `grove:<namespace>:tags`. Value is JSON `{ v: 1, lastModified, tags, value }`. Valkey expiry is 600s for product data, otherwise 86400s.

- [ ] **Step 1: Write failing tests** with an in-memory fake `CacheStore`:
  - `returns a stored entry`; `misses when any tag was flushed after lastModified` (including soft tags).
  - `misses a product entry older than 600s`; `keeps a non-product entry older than 600s`.
  - `namespaces keys`: same key under two namespaces does not collide.
  - `FETCH key excludes the build id; APP_PAGE key includes it`.
  - `treats invalid JSON and v !== 1 as a miss` (Review Focus 2).
  - `get resolves null when the store rejects`; `set and revalidateTag resolve when the store rejects` (Review Focus 3).
  - `breaker skips the store for openMs after a failure, then retries` (Review Focus 1), using fake timers.
  - `delegates to the file cache when VALKEY_URL is unset`.
- [ ] **Step 2:** Run `pnpm vitest run packages/next-cache`. Expected: FAIL.
- [ ] **Step 3:** Implement. Add a `build` script bundling `src/handler.ts` to `dist/handler.js` with esbuild (CommonJS, Node platform, `iovalkey` included, `next/*` external), because Next loads the handler directly and `transpilePackages` does not apply. Register it with Turborepo so app builds depend on it.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(next-cache): add Valkey-backed Next.js data cache handler`.

### Task 3: Wire the handler into four apps

**Files:**
- Modify: `apps/{nursery,goldberry,ggg,hub}/next.config.ts`, each app's `package.json`, each Dockerfile only if the build order requires it
- Test: `packages/next-cache/src/config.test.ts`

**Interfaces:**
- Consumes: `dist/handler.js`.
- Produces: `groveCacheConfig(): Pick<NextConfig, "cacheHandler" | "cacheMaxMemorySize" | "outputFileTracingIncludes">` from `@grove/next-cache/config`.

- [ ] **Step 1: Write failing test** `groveCacheConfig points at an existing built handler`: `expect(existsSync(cfg.cacheHandler)).toBe(true)`.
- [ ] **Step 2:** Run `pnpm vitest run packages/next-cache/src/config.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement and spread the config into all four `next.config.ts` files. The handler is always configured because prebuilt images must switch on by runtime env alone.
- [ ] **Step 4:** Run the test, then `pnpm turbo build --filter=goldberry --filter=nursery --filter=ggg --filter=hub`. Expected: PASS, and `dist/handler.js` is present in each `.next/standalone` output or at the traced path.
- [ ] **Step 5:** Boot Goldberry's standalone server with `VALKEY_URL` unset and hit `/` and `/shop`. Expected: 200, same behaviour as before.
- [ ] **Step 6:** Commit: `feat(storefront): load the shared cache handler in all apps`.

### Task 4: Catalog warmer

**Files:**
- Create: `packages/next-cache/src/warmer.ts`
- Modify: `apps/{nursery,goldberry,ggg}/instrumentation.ts`
- Test: `packages/next-cache/src/warmer.test.ts`

Hub has no product pages and gets no warmer.

**Interfaces:**
- Consumes: `CacheStore.acquireLock`, `createValkeyStore`, `withBreaker`.
- Produces:
  - `warmOnce(deps: WarmDeps): Promise<{ warmed: number; failed: number; skipped: boolean }>`
  - `startWarmer(deps: WarmDeps, opts?: { startDelayMs?: number; intervalMs?: number }): () => void`, defaults `20000` and `300000`.
  - `interface WarmDeps { store: CacheStore; listPaths(): Promise<string[]>; fetchPath(path: string): Promise<{ status: number }>; concurrency?: number; gapMs?: number; }`, defaults `2` and `250`.

- [ ] **Step 1: Write failing tests:**
  - `requests every listed path`.
  - `never exceeds the concurrency limit`.
  - `skips the cycle when the lock is held` (Review Focus 4): `expect(result.skipped).toBe(true)` and `fetchPath` not called.
  - `counts a 404 and continues` (Review Focus 5).
  - `resolves when listPaths rejects`.
  - `does not start without VALKEY_URL`.
- [ ] **Step 2:** Run `pnpm vitest run packages/next-cache/src/warmer.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Lock is `warm` with a 270s TTL. In each `register()`, when `NEXT_RUNTIME === "nodejs"`, build `listPaths` by paging `odoo.products.list` to the end of its count (nursery `/shop/<slug>`, goldberry and ggg `/shop/<id>`). `fetchPath` requests `http://127.0.0.1:${process.env.PORT}<path>`, so the cached render path does the work and no new credential is needed.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(storefront): warm the catalog after start and every 5 minutes`.

### Task 5: Local two-instance proof and docs

**Files:** Modify `CLAUDE.md` (KeyDB line), `docs/runbooks/isr-multi-instance.md`.

- [ ] **Step 1:** Repeat Task 0 Steps 2, 3 and 6 against the real package with two nursery instances. Expected: same results, and with a non-routable Valkey a page still returns 200 with no more than about 150ms added on the first read.
- [ ] **Step 2:** Update docs: the shared cache exists, its env vars, the 600s bound, how to switch it off. Replace the KeyDB line with the Valkey facts.
- [ ] **Step 3:** Run `pnpm vitest run` and typecheck for the four apps. Expected: PASS.
- [ ] **Step 4:** Commit and open the PR as Draft until Task 8 can exercise it.

---

## Part 2: `grove-odoo-modules` PR

### Task 6: Signal price changes

**Files:**
- Modify: `grove_headless/models/grove_publish_event.py` (`_availability_signature`), `grove_headless/models/product_template.py:257`, `grove_headless/docs/publish-webhook-contract.md`
- Create or modify: a `product.template.attribute.value` write hook in `grove_headless/models/`
- Test: `grove_headless/tests/test_availability_events.py`

**Interfaces:** Same event, `product.availability`, with no receiver change. Signature becomes `(in_stock, sale_ok, website_published, list_price, tuple(sorted(variant lst_price)))`.

- [ ] **Step 1: Write failing tests:**
  - `test_list_price_change_emits_once`: write `list_price`, flush, one delivered event.
  - `test_variant_price_extra_change_emits`: write `price_extra` on the attribute value, flush, one event for its template.
  - `test_same_price_write_emits_nothing`: write the current `list_price`, flush, no events.
  - `test_bulk_reprice_respects_cap`: more than `_AVAILABILITY_EMIT_CAP` templates, flush, exactly the cap emitted.
- [ ] **Step 2:** Run the module tests with the repo's documented Odoo test command, tag `publish_event`. Expected: the new tests FAIL.
- [ ] **Step 3:** Extend the signature, add `list_price` to `_GROVE_AVAILABILITY_FIELDS`, and call `note_availability_candidates` before `price_extra` writes. Update the contract doc.
- [ ] **Step 4:** Re-run. Expected: PASS, and read the `odoo.tests.result` line rather than the job colour (known false-green risk).
- [ ] **Step 5:** Commit: `feat(headless): signal storefronts when a product price changes`.

### Task 7: Speed up the detail read

**Files:** Modify `grove_headless/controllers/main.py` (`product_detail`, `_structure_variant`, `_ordered_variants`, and only what profiling implicates). Test: new `grove_headless/tests/test_product_detail_queries.py`.

- [ ] **Step 1:** Profile `/grove/api/v1/products/<id>` for a many-variant product on QA or a local restored dataset, recording query count and time per section. Save the numbers in the PR body with the 1.1s apple baseline.
- [ ] **Step 2: Write failing test** `test_detail_query_count_does_not_grow_with_variants`: query count for a 20-variant template is at most the count for a 2-variant template plus a small fixed allowance, set from Step 1. Follow `test_product_list_queries.py`.
- [ ] **Step 3:** Run it. Expected: FAIL.
- [ ] **Step 4:** Remove the per-variant reads with prefetching. Keep the response body byte-compatible, proven by comparing JSON before and after for three products.
- [ ] **Step 5:** Run the module tests. Expected: PASS. Re-measure apple on QA and record it.
- [ ] **Step 6:** Commit: `perf(headless): stop per-variant queries in product detail`.

---

## Part 3: `odoocker-goldberrygrove` PR

### Task 8: Valkey for QA and production

**Files:**
- Create: `infra/terraform/environments/production/valkey.tf`, `infra/terraform/environments/qa-app-platform/valkey.tf`
- Modify: `production/apps.tf`, `production/variables.tf`, the QA apps file, `scripts/qa-l3-teardown.sh`

**Interfaces:**
- Produces: `VALKEY_URL` and `GROVE_CACHE_NAMESPACE` (the app's tenant key, or `hub`), `RUN_TIME` scope, GENERAL type per the existing provider-drift note.
- `var.storefront_cache_apps`, `set(string)`, default `[]`, controls which production apps receive them.

- [ ] **Step 1:** Add `digitalocean_database_cluster.valkey` (`engine = "valkey"`, `size = "db-s-1vcpu-1gb"`, `node_count = 1`, name `grove-prod-valkey`, region `var.region`) and a `digitalocean_database_firewall` with `type = "app"` rules for the four storefronts.
- [ ] **Step 2:** Add a `dynamic "env"` to the tenant and hub apps, keyed on `var.storefront_cache_apps`.
- [ ] **Step 3:** Add the QA equivalent, `grove-qa-l3-valkey`, always enabled for QA storefronts. Destroy it in the compute teardown so it lives only with the train. No `prevent_destroy` on either: it is a rebuildable cache.
- [ ] **Step 4:** Run `terraform fmt -check` and `terraform validate` in both environments. Expected: pass. In production, a plan targeted to the new resources must show only additions and no droplet or app replacement.
- [ ] **Step 5:** Commit: `feat(infra): add Valkey data cache for storefronts`. Hand applies to Josh's terminal if the classifier or secret handling blocks them.

---

## Part 4: Rollout

### Task 9: QA verification and staged production enablement

- [ ] **Step 1:** Merge the three PRs for the Monday 11-16 train and bring up QA.
- [ ] **Step 2:** On QA with nursery at 2 instances: change a price in Odoo and confirm both instances show it within seconds; repeat for a sellout.
- [ ] **Step 3:** Redeploy a QA storefront. Expected: a previously warmed product responds without an Odoo wait.
- [ ] **Step 4:** Block Valkey two ways, an unreachable address and a refused connection. Expected: all storefronts keep serving pages.
- [ ] **Step 5:** Confirm a warm cycle does not measurably raise Odoo p95 for live requests.
- [ ] **Step 6:** Promote Wed 11-18 with `storefront_cache_apps = []`. Confirm no behaviour change.
- [ ] **Step 7:** Targeted apply to add `goldberry`, soak 24 hours, then `nursery`, soak 24 hours, then `ggg` and `hub`. Roll back by removing the app from the set.
- [ ] **Step 8:** Measure the spec's Done-when list on production and report the numbers.
