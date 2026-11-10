# Storefront shared cache and Odoo read speed: design

**Date:** 2026-11-09 · **Status:** awaiting owner approval · **Target:** Train #5 (promote Wed 2026-11-18)

## Why

Josh's direction: "ALL slowness is bad", on any product on any Grove site. Product pages took up to
about 2s because each view waited on sequential Odoo reads. The uncommitted branch
`fix/pdp-cached-product-reads` adds a 30s cache for product-page reads, which makes repeat views
10-20ms locally, but three limits remain:

1. **Cold views are slow.** Each instance starts with an empty cache after a deploy. The first view
   of a product still waits on Odoo (0.7-1.8s), and many-variant products are slow in Odoo itself
   (apple detail 1.1s, 36KB against about 8-10KB for others).
2. **Publishes reach one instance.** Nursery runs 2 App Platform instances with no shared cache and
   no sticky routing, so a `publish` webhook flushes only the instance it lands on. The other serves
   old stock and price until its window expires.
3. **Goldberry `/shop` is uncached.** It reads Odoo on every view (`force-dynamic`, uncached list).

## Evidence

- Live, 2026-11-09, 5 samples each, time to first byte: Goldberry `/` 0.15-0.26s, Goldberry `/shop`
  0.18-0.27s, nursery `/` 0.15-0.46s, nursery `/shop/chinese-chestnut` 0.92-1.59s (fix not deployed).
- An earlier single sample of Goldberry `/` took 4.24s and did not repeat. That page reads no Odoo or
  Ghost data. The cause is unknown; a cold or restarting 0.5GB instance is a guess.
- All storefronts are `apps-d-1vcpu-0.5gb` in `nyc`: nursery 2 instances; goldberry, ggg, hub 1 each.
  Next.js is 15.5.x with `output: "standalone"`.
- No Redis, KeyDB or Valkey exists in the code or in the DigitalOcean account. The KeyDB line in the
  repo `CLAUDE.md` is out of date.
- Odoo is one droplet, `grove-prod-odoo`, 2 vCPU / 4GB.

## Decisions Josh made

- Fix any slowness; both first-after-deploy and first-after-quiet-spell views are in scope.
- Changes to `grove-odoo-modules` are allowed.
- Stale stock and price may stay as they are for now but should be fixed if there is a way.
- He asked for a Valkey and Varnish cost comparison, then approved writing up the recommended
  Valkey-only option below.
- Compile the work into one effort, including the existing product-page fix. Separate repos mean
  three PRs under that one effort.
- No visitor sees product data older than 10 minutes. An entry past that age waits for a fresh read
  instead of being served. The catalog refreshes in the background about every 5 minutes.
- Stock, publish status and price changes appear within seconds. Descriptions, photos and other
  edits wait for the normal cache window.

## Calls made by the author (open to override)

- 30s display freshness applies to Goldberry `/shop`, matching product pages. Josh did not object
  but did not explicitly rule on it.
- One single-node Valkey shared by all four storefronts.
- No Varnish. See "Alternatives rejected".

## Goals

1. A stock, publish-status or price change reaches every instance of the affected site, normally
   within seconds.
2. A deploy does not empty the cache. Visitors after a deploy get cached product data.
3. Products that have not been viewed recently are still fast, through warming.
4. The slowest Odoo product detail reads get materially faster at the source.
5. Goldberry `/shop` gets the same bounded cache as the nursery catalog.
6. Valkey being down makes pages slower, never broken.

## Non-goals

- Caching whole HTML pages or changing the `no-store` response headers.
- Removing `headers()` from the root layouts.
- Any Cloudflare zone or proxy change. The delivery standard treats those as storefront releases, and
  the 2026-11-09 nursery proxy attempt was rolled back the same day.
- Scaling or resizing Odoo or the App Platform instances.
- Changes to the hub marketplace's data freshness beyond sharing the cache.

## Anti-goals: failure even if it technically works

- Checkout, cart quote or promo pricing reads from any cache. They must stay live.
- One brand can read another brand's cached data.
- A Valkey outage returns errors or hangs requests noticeably longer than an uncached read.
- Cache warming slows Odoo enough to hurt live orders or trips alerts.
- A cached secret or per-customer response. Only anonymous catalog reads may be stored.

## Target design

### Part 1: `grove-sites` (one PR)

- Ship the existing branch: `display` product reads, slug lookup cache, tag flush in the publish
  webhook, tests and runbook update.
- Add a Next.js Data Cache handler backed by Valkey, enabled by a `VALKEY_URL`-style env var, for
  nursery, goldberry, ggg and hub. When the variable is unset the app uses today's local cache, so
  local dev and rollback need no code change.
- Cache keys are namespaced by tenant and by build-independent data identity, so entries survive
  deploys and tenants cannot collide.
- Tag flushes (`revalidateTag`) must take effect on every instance. Path-based flushes in the webhook
  must also reach every instance, or be replaced with tags on the reads they target.
- Every Valkey call has a short timeout. On failure or timeout the read proceeds as if uncached, logs
  it, and does not retry within the request.
- Goldberry `/shop` reads its list with the 30s display window, tagged so the publish webhook can
  flush it.
- Warming: after each deploy of a storefront, and about every 5 minutes, refresh published products
  through the cached path, with bounded concurrency so Odoo is not stampeded. This keeps rarely
  viewed products warm.
- Entries carry a hard 10-minute maximum age in Valkey. Past it, the read waits for Odoo.
- Update `CLAUDE.md`'s KeyDB line and `docs/runbooks/isr-multi-instance.md`.

### Part 2: `grove-odoo-modules` (one PR)

Profile `/grove/api/v1/products/<id>` and fix what is slow for many-variant products, starting from
apple. Measure before changing. The response contract stays compatible with the current
`@grove/odoo-client`.

Also signal price changes. Today `product.availability` fires only when in-stock, `sale_ok` or
`website_published` crosses a boundary, so a price edit sends nothing. Extend the existing signed,
deduplicated publish channel so a price change flushes that product, batched per transaction so bulk
repricing does not flood the storefronts. Variant price changes count. Whether this is a new event
type or an extended signature is the builder's choice.

### Part 3: `odoocker-goldberrygrove` (one PR)

Terraform for one managed Valkey node ($15/month, 1 GiB, `nyc3`), restricted to the storefront apps,
with the connection value delivered through the existing secret path. Applies must be `-target`ed.
Never print the connection secret.

## First step: prove the risky part

Before building Part 1, run a throwaway spike: two local production instances of one app sharing one
Valkey, on the repo's Next 15.5 version. Confirm that `revalidateTag` on one instance changes what
the other serves, that entries survive a rebuild, and that killing Valkey only slows requests. No
published package was confirmed to do this on Next 15 with Valkey.

If tag flushes cannot be shared reliably, keep Valkey for shared storage only if it still survives
deploys, and have the publish webhook notify every instance directly or shorten the window. Report
that outcome to Josh before continuing.

## Rollout

All code ships in the normal train: up Mon 11-16, promote Wed 11-18, with the cache env var unset
in production. After promote, turn it on one site at a time by targeted env change, with a soak
between sites: goldberry (1 instance, lowest order volume), then nursery with the 2-instance check,
then ggg and hub. Unset the env var to roll back. This extends rollout past 11-18. *(Author's call.)*

QA gets its own short-lived Valkey node, created and destroyed with the train's QA environment, so
QA tests can never touch production's cache. Billing for the few days it exists is a small addition
to the $15/month. Test the outage two ways: an unreachable address that hangs, because a hang is the
dangerous failure, and a refused connection. *(Author's call.)*

## Done when

- A stock or price change in Odoo shows on both nursery instances, normally within seconds.
- No storefront serves a product entry older than 10 minutes.
- Warming runs at about 5-minute intervals without measurably slowing live Odoo requests.
- After a deploy, a previously warmed product responds without an Odoo wait.
- Stopping Valkey on QA leaves every storefront serving pages.
- Goldberry `/shop` issues at most one Odoo list read per 30s window while it has traffic.
- Apple's Odoo detail read is measurably faster than the 1.1s baseline, with the result recorded.
- Checkout, cart quote and promo code paths still read live, enforced by existing and new tests.

## Costs

| Item | Monthly |
|---|---|
| Valkey single node, 1 GiB | $15 |
| Valkey with standby, if later wanted (2 GiB primary + standby) | $60 |

## Alternatives rejected

- **Varnish on a droplet** ($12-24/month plus a TLS terminator). It would sit in one region in the
  request path of every storefront, needs a DNS move, cannot cache while pages are `no-store`, and
  needs purge wiring. It removes little time beyond what the data cache already saves.
- **Valkey plus Varnish.** Costs the risks of Varnish for little added speed.
- **Webhook fan-out only.** No new service, but does not survive deploys. Held as the fallback above.

## Left to the builder

Choice of cache-handler package or a small hand-written handler, key format, timeout value, warming
trigger mechanism and concurrency, the exact Odoo optimisation, and how the tests are arranged.
