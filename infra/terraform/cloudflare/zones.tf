# One invocation of the per-zone hardening module per storefront zone. The 7
# zones share one module (DRY, uniform policy); only zone_id/domain differ. The
# module emits one cloudflare_ruleset per phase (managed WAF, cache, rate-limit,
# custom firewall) plus the optional bot layer.
#
# Rollout order (§6): the module is identical across zones; sequencing is done
# by the toggle variables (log-first) and by flipping `enable_bot_management`
# on `woodworkingeorge.com` first (rollout_first = true in the zones map). Apply
# is per-target-zone during rollout, e.g.:
#   terraform apply -target='module.zone_hardening["ggg"]'
module "zone_hardening" {
  source   = "./modules/zone-hardening"
  for_each = var.zones

  zone_id   = each.value.zone_id
  zone_name = each.value.domain
  plan_tier = var.plan_tier

  waf_managed_enabled  = var.waf_managed_enabled
  cache_rules_enabled  = var.cache_rules_enabled
  rate_limit_mode      = var.rate_limit_mode
  custom_firewall_mode = var.custom_firewall_mode

  # Bot layer only fires on the rollout-first zone until it soaks; other zones
  # stay off even when the global switch flips, until this per-zone gate widens.
  # During staged rollout, set enable_bot_management=true and this stays scoped
  # to woodworkingeorge.com first; widen by editing the condition after soak.
  enable_bot_management = var.enable_bot_management && each.value.rollout_first

  monitoring_secret_header_name  = var.monitoring_secret_header_name
  monitoring_secret_header_value = var.monitoring_secret_header_value
  payment_webhook_paths          = var.payment_webhook_paths
  geo_block_countries            = var.geo_block_countries
}
