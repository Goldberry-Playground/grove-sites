# grove-next-image-cache (GOL-2073)

Accept-keyed edge cache for Next.js `/_next/image` on our **Cloudflare Free**
storefront zones. Fixes the ~1.6s first-view photo latency (every size variant
was an Odoo round-trip; `cf-cache-status: BYPASS`) **without** re-opening the
GOL-885/GOL-873 AVIF cache-poisoning bug.

## Why a Worker

`/_next/image` content-negotiates AVIF → WebP → original on `Accept` and emits
`Vary: Accept`. Cloudflare's shared cache ignores `Vary`, and a cache key that
includes a request header is **Enterprise-only** (verified 2026-09-04, err 1135).
The Worker buckets `Accept` into `avif|webp|orig`, asks origin with a canonical
Accept for that bucket, and stores the result in the Cache API under a synthetic
key `/__grove-img-cache/<bucket>/_next/image?...`. One entry per format, so a
bucket's bytes only ever reach clients in that bucket.

Safety properties (all unit-tested in `test/`):

- Origin fetch uses `cache: "no-store"` → independent of cache-rules.tf Rule 1b
  and of origin `CDN-Cache-Control`.
- Only `200 image/*` is stored; errors/HTML never are.
- Client-facing `Cache-Control` is the origin's, replayed verbatim on HIT; the
  Worker owns the **edge** TTL only (`EDGE_TTL_SECONDS`, default 1 day).
- **Fails open**: any Worker/Cache API fault → plain origin pass-through.
- Debug headers: `x-grove-img-cache: HIT|MISS`, `x-grove-img-fmt: <bucket>`.

## Test

```sh
npm test        # == node --test test/*.test.mjs (zero deps, node >= 20)
```

## Deploy (Terraform, gated)

Codified in `infra/terraform/cloudflare/next-image-cache.tf`, off by default
(`next_image_cache_zones = []` → no-op plan). Enable per zone:

```sh
cd infra/terraform/cloudflare
op run --env-file=.env.op -- terraform plan  -var='next_image_cache_zones=["nursery"]'
op run --env-file=.env.op -- terraform apply -var='next_image_cache_zones=["nursery"]'
```

The token needs **Account → Workers Scripts:Edit** and **Zone → Workers
Routes:Edit** (plus the existing ruleset scopes). Workers Free = 100k req/day.

**Rollback:** `next_image_cache_zones = []` + apply → routes removed, path goes
straight to origin (today's behavior). Purge is unnecessary: the synthetic keys
are unreachable once the route is gone.

## Acceptance probe (run after enabling a zone)

```sh
U='https://atthegrovenursery.com/_next/image?url=<encoded-src>&w=640&q=75'
for a in image/avif image/webp image/jpeg; do for i in 1 2; do
  curl -s -o /dev/null -D - -H "Accept: $a" "$U" \
    | grep -iE '^(content-type|cf-cache-status|x-grove-img-(cache|fmt)):' ; echo "-- $a #$i"
done; done
```

Pass = each Accept returns its **own** `content-type`, and the 2nd request per
format shows `x-grove-img-cache: HIT` (and `cf-cache-status: HIT`). If any
variant returns another's format, **STOP and roll back** — GOL-885 regressed.

## Sequencing with the app header flip (Ada, GOL-1874 perf child)

Not a prerequisite. Because the Worker bypasses CF's auto-cache on its origin
fetch, Ada's `CDN-Cache-Control` flip is independent of the Worker. It is **not**
independent of the zone cache rules: `/_next/image` must stay out of CF's
automatic cache (Rule 1b, present in code but absent from prod state as of
2026-09-21) before origin ever emits a cacheable `CDN-Cache-Control`.
