# Tier 0 — Cloudflare Managed WAF ruleset "on".
#
# The `http_request_firewall_managed` phase is where you deploy Cloudflare's
# curated managed rulesets. We deploy the Cloudflare Managed Ruleset (the
# baseline OWASP-adjacent set). Its built-in rule actions are Cloudflare-tuned
# (mostly log/challenge for the anomaly set, block for known exploits), so
# turning it on is low-risk — it is NOT a blanket block. Fine-grained per-rule
# overrides (e.g. raising the anomaly-score sensitivity) are a deliberate
# follow-up, not part of the initial codify.
#
# Managed ruleset id efb7b8c949ac4650a09736fc376e9aee is Cloudflare's stable,
# account-agnostic "Cloudflare Managed Ruleset" id (documented, same across
# zones). Deploying by id via action=execute is the provider-blessed pattern.

resource "cloudflare_ruleset" "managed_waf" {
  count = var.waf_managed_enabled ? 1 : 0

  zone_id = var.zone_id
  name    = "grove-tier0-managed-waf"
  kind    = "zone"
  phase   = "http_request_firewall_managed"

  rules {
    ref         = "grove_deploy_cf_managed"
    description = "Tier 0: deploy Cloudflare Managed Ruleset (${var.zone_name})"
    expression  = "true"
    action      = "execute"
    enabled     = true

    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"
    }
  }
}
