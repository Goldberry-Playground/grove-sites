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
