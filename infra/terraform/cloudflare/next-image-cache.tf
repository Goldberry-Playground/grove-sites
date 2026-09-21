# GOL-2073 — Accept-keyed edge cache for Next.js /_next/image on FREE zones.
#
# A native Cache Rule with an `Accept` request-header cache key is Cloudflare
# ENTERPRISE-only (verified 2026-09-04: `cache/variants` err 1135 on our Free
# zones). Caching /_next/image Accept-blind re-opens the GOL-885/GOL-873 AVIF
# poisoning bug, so cache-rules.tf Rule 1b keeps CF's AUTOMATIC cache OFF the
# path. This Worker adds a SAFE edge cache on top: it folds a normalized Accept
# bucket (avif|webp|orig) into a synthetic Cache API key, so each format has its
# own entry. Rule 1b is intentionally left unchanged. Design + tests:
# infra/cloudflare-workers/next-image-cache/.
#
# Gated by `next_image_cache_zones` (default []) → a no-op plan until a zone is
# explicitly enrolled. Rollout: nursery first (the measured 1.6s photo latency),
# run the README acceptance probe, then the other storefronts.
#
# Token: applying this needs Account → Workers Scripts:Edit and
# Zone → Workers Routes:Edit on the token in TF_VAR_cloudflare_api_token, in
# addition to the ruleset scopes already documented in variables.tf.
#
# Rollback: set next_image_cache_zones = [] and apply (drops the routes →
# /_next/image goes straight to origin again, exactly today's behavior). The
# Worker also fails OPEN at runtime (any fault → plain origin pass-through).

locals {
  next_image_cache_enabled = length(var.next_image_cache_zones) > 0
}

resource "cloudflare_workers_script" "next_image_cache" {
  count = local.next_image_cache_enabled ? 1 : 0

  account_id         = var.cloudflare_account_id
  name               = "grove-next-image-cache"
  module             = true
  content            = file("${path.module}/../../cloudflare-workers/next-image-cache/src/worker.mjs")
  compatibility_date = "2026-09-01"

  plain_text_binding {
    name = "EDGE_TTL_SECONDS"
    text = tostring(var.next_image_cache_edge_ttl_seconds)
  }
}

resource "cloudflare_workers_route" "next_image_cache" {
  for_each = toset(var.next_image_cache_zones)

  zone_id     = var.zones[each.key].zone_id
  pattern     = "${var.zones[each.key].domain}/_next/image*"
  script_name = cloudflare_workers_script.next_image_cache[0].name
}
