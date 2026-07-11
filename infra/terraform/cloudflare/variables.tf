variable "cloudflare_api_token" {
  description = <<-EOT
    Scoped Cloudflare API token for the storefront account. Minimum permissions:
    Zone:Read, Zone WAF:Edit, Firewall Services:Edit, Cache Rules:Edit. Injected
    at plan/apply time from 1Password (TF_VAR_cloudflare_api_token) — never
    committed. Provisioned by CEO Rick per GOL-264 blocker; durable mechanism is
    the DevOps secrets pipeline (GOL-88).
  EOT
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID for the storefront account (Overview page sidebar). Needed for account-scoped resources; also disambiguates zone lookups."
  type        = string
}

variable "plan_tier" {
  description = <<-EOT
    Cloudflare plan tier of the storefront zones: "free", "pro", "business", or
    "enterprise". DECIDES the bot layer: free => Bot Fight Mode (fight_mode, no
    scope/log), pro/business => Super Bot Fight Mode (sbfm_* actions, scopeable),
    enterprise => full Bot Management. Confirm against the REAL plan before apply
    (GOL-264 scope item 1). Left unset-safe by `enable_bot_management` default.
  EOT
  type        = string
  default     = "unknown"

  validation {
    condition     = contains(["free", "pro", "business", "enterprise", "unknown"], var.plan_tier)
    error_message = "plan_tier must be one of: free, pro, business, enterprise, unknown."
  }
}

variable "zones" {
  description = <<-EOT
    The 7 storefront zones to harden, keyed by a stable short name. Each value is
    the Cloudflare zone_id (provisioned by CEO Rick per the GOL-264 blocker) plus
    the apex domain (for readable rule descriptions). `rollout_first` marks the
    lowest-traffic zone that goes first for the no-log-mode bot layer (§6 rollout;
    woodworkingeorge.com). Populate real zone_ids in terraform.tfvars, then
    `terraform import` each zone before any apply (README import runbook).
  EOT
  type = map(object({
    zone_id       = string
    domain        = string
    rollout_first = optional(bool, false)
  }))
  # Placeholders documented in terraform.tfvars.example. Kept empty here so a
  # bare `terraform plan` with no tfvars is an explicit "provide the zones"
  # error, not a silent no-op.
  default = {}
}

# ── Rollout / safety toggles ────────────────────────────────────────────────
# Every mitigating layer defaults to LOG/OFF so the first apply after import is
# provably no-drift and non-disruptive. Flip each on in a reviewed PR once the
# prior layer has soaked (README §6 rollout order).

variable "waf_managed_enabled" {
  description = "Turn the Cloudflare Managed WAF ruleset on (Tier 0). Safe: managed ruleset defaults are log/challenge, not hard block."
  type        = bool
  default     = true
}

variable "cache_rules_enabled" {
  description = "Apply cookie-aware Cache Rules (Tier 0). Bypasses cache when a session cookie is present; never-caches /checkout|/account|/cart|/api/*."
  type        = bool
  default     = true
}

variable "rate_limit_mode" {
  description = <<-EOT
    Rate-limit rollout mode (Tier 1): "log" (log-only, no mitigation — default
    for first soak), "on" (enforce: /api/* + XHR => block 429/JSON, navigation =>
    Managed Challenge), or "off". Log-first is the §6 requirement.
  EOT
  type        = string
  default     = "log"

  validation {
    condition     = contains(["log", "on", "off"], var.rate_limit_mode)
    error_message = "rate_limit_mode must be one of: log, on, off."
  }
}

variable "custom_firewall_mode" {
  description = <<-EOT
    Custom firewall rollout mode (Tier 1 challenge layer + allowlists): "log",
    "on", or "off". Log-first per §6. The allowlist `skip` rule is ALWAYS ordered
    first regardless of mode so verified crawlers / webhooks / monitoring are
    never affected while the challenge layer soaks.
  EOT
  type        = string
  default     = "log"

  validation {
    condition     = contains(["log", "on", "off"], var.custom_firewall_mode)
    error_message = "custom_firewall_mode must be one of: log, on, off."
  }
}

variable "enable_bot_management" {
  description = <<-EOT
    Master switch for the bot layer (Tier 0). Defaults OFF because the concrete
    resource shape depends on plan_tier (BFM vs SBFM), which is a GOL-264 blocker
    input. Flip on ONLY after plan_tier is confirmed and the lowest-traffic zone
    (woodworkingeorge.com) has gone first (§6 — BFM has no log mode).
  EOT
  type        = bool
  default     = false
}

# ── Allowlist inputs (§4) — machine clients that must never be challenged ────

variable "monitoring_secret_header_name" {
  description = "Header name the monitoring/health-check clients send (value in monitoring_secret_header_value) to be allowlisted. Path+header, not IP."
  type        = string
  default     = "x-grove-monitor"
}

variable "monitoring_secret_header_value" {
  description = "Shared-secret value for the monitoring allowlist header. Injected from 1Password (TF_VAR_monitoring_secret_header_value); never committed."
  type        = string
  default     = ""
  sensitive   = true
}

variable "payment_webhook_paths" {
  description = "Exact paths for payment/processor webhooks to allowlist (matched by path; signature verification stays the app's job, NOT IP allowlisting)."
  type        = list(string)
  default     = ["/api/webhooks/square", "/api/webhooks/stripe"]
}
