output "zone_id" {
  description = "The zone id this module manages."
  value       = var.zone_id
}

output "waf_ruleset_id" {
  description = "Managed-WAF ruleset id (null when disabled)."
  value       = try(cloudflare_ruleset.managed_waf[0].id, null)
}

output "cache_ruleset_id" {
  description = "Cache-rules ruleset id (null when disabled)."
  value       = try(cloudflare_ruleset.cache_rules[0].id, null)
}

output "ratelimit_ruleset_id" {
  description = "Rate-limit ruleset id (null when off)."
  value       = try(cloudflare_ruleset.rate_limit[0].id, null)
}

output "custom_ruleset_id" {
  description = "Custom-firewall (allowlist) ruleset id (null when off)."
  value       = try(cloudflare_ruleset.custom_firewall[0].id, null)
}
