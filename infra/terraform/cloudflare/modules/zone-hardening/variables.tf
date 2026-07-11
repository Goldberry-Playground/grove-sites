variable "zone_id" {
  description = "Cloudflare zone ID this module hardens."
  type        = string
}

variable "zone_name" {
  description = "Apex domain for the zone (used in human-readable rule descriptions/refs only)."
  type        = string
}

variable "plan_tier" {
  description = "CF plan tier: free | pro | business | enterprise | unknown. Selects BFM vs SBFM."
  type        = string
}

variable "waf_managed_enabled" {
  description = "Enable the Cloudflare Managed WAF ruleset (Tier 0)."
  type        = bool
}

variable "cache_rules_enabled" {
  description = "Apply cookie-aware Cache Rules (Tier 0)."
  type        = bool
}

variable "rate_limit_mode" {
  description = "log | on | off (Tier 1 rate limiting)."
  type        = string
}

variable "custom_firewall_mode" {
  description = "log | on | off (Tier 1 challenge layer + allowlists)."
  type        = string
}

variable "enable_bot_management" {
  description = "Enable the plan-appropriate bot layer for THIS zone (BFM/SBFM)."
  type        = bool
}

variable "monitoring_secret_header_name" {
  description = "Header name that allowlists monitoring/health-check clients."
  type        = string
}

variable "monitoring_secret_header_value" {
  description = "Shared-secret value for the monitoring allowlist header (sensitive)."
  type        = string
  sensitive   = true
}

variable "payment_webhook_paths" {
  description = "Exact payment/processor webhook paths to allowlist by path."
  type        = list(string)
}

locals {
  # Session-cookie presence heuristic. Storefront apps set an auth/session cookie
  # once a user has a cart or is logged in; any such request must bypass full-page
  # cache and skip challenges. Cookie names are the common Next.js/commerce set;
  # tighten to the real cookie name(s) once confirmed with Engineering - Alice.
  session_cookie_expr = "(len(http.request.cookies[\"__Secure-grove-session\"]) > 0 or len(http.request.cookies[\"grove_session\"]) > 0 or len(http.request.cookies[\"cart\"]) > 0)"

  # Never-cache dynamic/PII paths regardless of cookie state.
  never_cache_path_expr = "(starts_with(http.request.uri.path, \"/checkout\") or starts_with(http.request.uri.path, \"/account\") or starts_with(http.request.uri.path, \"/cart\") or starts_with(http.request.uri.path, \"/api/\"))"

  # XHR / fetch API traffic vs top-level navigation. Sec-Fetch-Mode is set by all
  # modern browsers: "navigate" for page loads, "cors"/"no-cors"/"same-origin"
  # for fetch/XHR. API + XHR get JSON 429s; navigations get a Managed Challenge.
  is_navigation_expr = "(http.request.headers[\"sec-fetch-mode\"][0] eq \"navigate\")"
  is_api_or_xhr_expr = "(starts_with(http.request.uri.path, \"/api/\") or http.request.headers[\"sec-fetch-mode\"][0] in {\"cors\" \"no-cors\" \"same-origin\"})"
}
