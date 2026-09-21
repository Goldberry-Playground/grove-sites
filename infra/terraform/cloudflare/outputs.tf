output "hardened_zones" {
  description = "Map of zone short-name => { zone_id, managed ruleset ids } for the zones under management. Use to cross-check against the CF dashboard after import."
  value = {
    for k, m in module.zone_hardening : k => {
      zone_id              = m.zone_id
      waf_ruleset_id       = m.waf_ruleset_id
      cache_ruleset_id     = m.cache_ruleset_id
      ratelimit_ruleset_id = m.ratelimit_ruleset_id
      custom_ruleset_id    = m.custom_ruleset_id
    }
  }
}

output "next_image_cache_routes" {
  description = "GOL-2073: zone short-name => Worker route pattern for the Accept-keyed /_next/image edge cache (empty until enrolled)."
  value       = { for k, r in cloudflare_workers_route.next_image_cache : k => r.pattern }
}
