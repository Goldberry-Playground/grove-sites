# ISR revalidation under multiple App Platform instances

**Status:** verified 2026-10-19 (GOL-3446); shared Valkey cache added and proven locally
2026-11-10 · applies to every storefront app in this monorepo

## Shared data cache (Valkey)

Nursery, goldberry, ggg and hub load `@grove/next-cache` as their Next.js `cacheHandler`
(`groveCacheConfig()` in each `next.config.ts`). It is always configured; runtime env decides
what it does.

| Env | Effect |
|---|---|
| `VALKEY_URL` | Valkey connection URL (secret; delivered by the infra repo, never printed) |
| `GROVE_CACHE_NAMESPACE` | Key prefix `grove:<namespace>:`, one per app (e.g. `nursery`) so brands never share entries |
| `PORT` | Needed by the catalog warmer to request its own pages (images set `3001`) |

**With both `VALKEY_URL` and `GROVE_CACHE_NAMESPACE` set:**

- Data Cache entries (`fetch` reads with `next.revalidate`) live in Valkey under
  `grove:<ns>:d:<key>`. Fetch keys do not depend on the build, so a deploy does not empty them.
  Page and route entries use `grove:<ns>:b:<BUILD_ID>:<key>`; image-optimizer entries stay on
  local disk.
- `revalidateTag` and `revalidatePath` write a flush time to the hash `grove:<ns>:tags`, stamped
  with Valkey server time. Every instance checks it on read, so the publish webhook landing on
  one instance flushes all of them.
- **600s bound:** an entry tagged `grove-catalog` or `grove-product-<id>` is never served older
  than 600s, from Valkey or from the local fallback, and expires in Valkey after 600s. Other
  entries expire after 24h.
- Nursery, goldberry and ggg warm the catalog: 20s after boot, then every 300s, each instance
  tries the shared `warm` lock (270s); the winner requests every published product page on its
  own `PORT` (2 at a time, 250ms gap). Only one instance warms per cycle.
- Valkey commands time out after 150ms and never retry. Any failure opens a 10s per-instance
  breaker; while open, or before the first connect, reads and writes fall back to the local file
  cache (with the 600s bound), so pages stay up and Odoo is not hit on every request. A flush
  bypasses the breaker; a failed flush logs `[grove-cache] revalidateTag failed for ...`, and
  that flush then relies on the 30s and 600s windows on other instances.
- Logs to watch: `[grove-cache] ... failed` and `[grove-warmer] cycle done: N warmed, M failed`.

**With either var unset** the handler passes every call straight to Next's own file cache:
exactly the per-instance behaviour described in the rest of this doc, with no 600s bound and no
warmer. Local dev, tests and `next build` run this way.

**Switching it off (rollback):** unset `VALKEY_URL` (or `GROVE_CACHE_NAMESPACE`) on the app and
redeploy or restart. No code change or rebuild is needed; the same image serves both modes.
To force every instance to refetch while it stays on, flush the tag (publish webhook) or delete
the app's `grove:<ns>:*` keys.

**Next.js version pin:** `next` is pinned to exactly `15.5.28` in the four apps because the
handler depends on cache internals (`FileSystemCache` import path, the `get`/`set` ctx shapes,
route-cache keys) that changed between 15.5 patch releases. Any Next bump must re-run the
two-instance cache proof (spike recipe: `.superpowers/sdd/2026-11-09-storefront-shared-cache/`
task 0 and task 5 reports, if still present; otherwise two `next start` instances on one
`valkey/valkey:8` with a counting mock Odoo) before it ships.

Checkout, cart quote and promo routes read Odoo live and never touch this cache.

## Why this exists

The storefronts are fed by **on-demand ISR revalidation**: Odoo POSTs a signed
`publish` webhook (`guide.publish` / `product.availability`) to each app's
`/api/webhooks/publish`, which calls `revalidatePath('/shop')` +
`revalidatePath('/shop/<id>')` (see `packages/checkout/src/api/createPublishWebhookRoute.ts`).

DigitalOcean App Platform load-balances across instances with **no sticky
routing**. Without the shared Valkey cache above (env unset), there is also no
shared ISR cache: once an app runs on >1 instance, a single webhook POST reaches
**only one instance**, and the others keep serving their cached pages until
their own time-based `revalidate` window fires. The rest of this doc describes
that baseline, which still applies whenever Valkey is off or unreachable.

`odoocker-goldberrygrove#914` scaled `grove-nursery-prod` 1 → 2 to survive
single-container replacements. This doc records the audit that confirmed that is
safe, and the rule to apply before scaling the others.

## The rule

**Every storefront read must be either per-request-fresh (`force-dynamic` with
an uncached fetch) or carry a bounded time-based `revalidate`. Never rely on the
publish webhook alone — it is a fast-path optimization, not a correctness
guarantee, and it is a no-op on every instance it does not happen to hit.**

Concretely: no `fetch(..., { next: { revalidate: false } })` and no
`export const revalidate = false` on a page that renders volatile
availability/pricing. (A repo-wide grep for `revalidate: false` must stay empty.)

## Current state — staleness ceiling on the instance that MISSED the webhook

| Surface | Mechanism | Worst-case stale |
|---|---|---|
| nursery `/shop/[slug]` PDP — availability, price, variants | `force-dynamic` page; product read uses `freshness: "display"` → `next.revalidate: 30`, tagged per product (slug-to-id lookup 300s) | **≤30s while the product gets traffic; the first view after a quiet spell can be older, then refreshes in the background** |
| nursery `/shop` listing — availability, price, nav | `odoo.products.list()` / `catalog.nav()` → `next.revalidate: 30` | **≤30s** |
| nursery PDP shipping rate table | `SHIPPING_RATES_REVALIDATE_SECONDS = 3600` (time-based only; no webhook feeds it) | **≤1h** (same at any instance count) |
| goldberry `/shop` | `force-dynamic` page, but the list fetch sets `next.revalidate: 30` (honoured under `force-dynamic`), tagged `grove-catalog` | **≤30s** |
| goldberry `/shop/[id]` | same `display` read as nursery | **same as nursery PDP** |
| ggg `/shop` | static coming-soon page, no Odoo call | n/a |
| ggg `/shop/[id]` | same `display` read as nursery | **same as nursery PDP** |
| checkout cart quote and promo routes | `odoo.products.get` live read | **0s** |
| hub marketplace / journal / home | `export const revalidate` 60–3600s | **≤ that window** |

### Why this is acceptable as-is (no hardening required)

- **Checkout is the source of truth.** Since the product-page latency fix, a PDP
  can show cached availability or price (see the table). The cart quote and promo
  routes still read live from Odoo, and checkout validates stock server-side, so
  a stale PDP does not decide what the order is quoted or whether stock is taken.
  Running 2 instances does not materially raise overselling risk.
- **The bound is the floor, not the fast path.** `createPublishWebhookRoute`'s
  own docstring calls the webhook "the fast path" and the ISR window "the safety
  net that catches any missed or failed delivery." A webhook reaching only 1 of
  N instances is exactly a per-instance missed delivery — the 30s TTL is the
  floor that holds everywhere. Scaling 1 → N lowers the *fast-path hit rate*
  (fewer instances see the ~5s refresh), it does not raise the staleness
  *ceiling*.

## Before scaling goldberry / ggg / hub past 1 instance

1. Re-run the grep: `rg -n "revalidate:\s*false|export const revalidate\s*=\s*false" apps packages` must return nothing.
2. For each page that renders volatile data, confirm it is in the table above —
   `force-dynamic`+uncached, or a bounded `next.revalidate` / `export const revalidate`.
   A new page added since this audit must be added to the table with its bound.
3. If a surface ever needs **webhook-timely propagation on every instance**
   (bound too loose to tolerate, e.g. a flash sellout that must clear in seconds
   fleet-wide), turn on the shared Valkey cache (see "Shared data cache" above)
   so on-demand `revalidateTag`/`revalidatePath` propagates across instances,
   not a per-instance tightening of the TTL (which just hammers the single Odoo
   droplet N× harder).
