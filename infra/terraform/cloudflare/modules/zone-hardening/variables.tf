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

variable "session_cookie_names" {
  description = <<-EOT
    Names of the cookies that mark a personalized / logged-in session. Any request
    carrying one of these bypasses full-page cache (Cache Rule 2). DEFAULTS TO []
    because the Grove storefront is currently COOKIELESS — the cart lives in
    localStorage and there is no server session cookie (confirmed 2026-07-12,
    GOL-315 / Alice review nit on GOL-264). With [] the session-bypass rule is not
    emitted at all (a clean no-op) rather than matching placeholder cookie names
    that never exist; the never-cache path rule + the /checkout|/account|/cart|
    /api/* bypass keep the no-full-page-cache guarantee on their own. Populate the
    real cookie name(s) here if the storefront ever introduces a server session and
    Rule 2 reappears automatically.
  EOT
  type        = list(string)
  default     = []
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

variable "geo_block_countries" {
  description = "ISO country codes for the EXISTING GOL-44 geo block, reproduced verbatim in the custom-phase ruleset for a no-drift import. NOT a new Phase-2 geo rule."
  type        = list(string)
  default     = ["CN", "RU"]
}

locals {
  # Session-cookie presence heuristic, built from the configured cookie name(s).
  # A logged-in / personalized request carries one of these and must bypass
  # full-page cache. The Grove storefront is COOKIELESS today (cart=localStorage),
  # so `session_cookie_names` defaults to [] and this expression is unused — Rule 2
  # is not emitted (see cache-rules.tf `has_session_cookie` gate). If the list is
  # populated later, the OR-of-presence matcher is generated automatically.
  has_session_cookie  = length(var.session_cookie_names) > 0
  session_cookie_expr = "(${join(" or ", [for c in var.session_cookie_names : "len(http.request.cookies[\"${c}\"]) > 0"])})"

  # Never-cache dynamic/PII paths regardless of cookie state.
  never_cache_path_expr = "(starts_with(http.request.uri.path, \"/checkout\") or starts_with(http.request.uri.path, \"/account\") or starts_with(http.request.uri.path, \"/cart\") or starts_with(http.request.uri.path, \"/api/\"))"

  # Next.js image optimizer (GOL-873). Cloudflare's edge cache does NOT vary on
  # `Accept` (only on Accept-Encoding), but /_next/image responses content-
  # negotiate their format (AVIF/WebP/JPEG) behind a single URL and carry an
  # image content-type + a long Cache-Control. Without a dedicated bypass the
  # FIRST client's negotiated format is cached under an Accept-blind key and
  # served to EVERY later client of that URL, so a Safari<16.4 / legacy visitor
  # gets an undecodable AVIF for the full TTL. This path is bypassed (Rule 1b in
  # cache-rules.tf) AND excluded from the anonymous cache matcher below, so the
  # two never overlap.
  image_optimizer_path_expr = "(starts_with(http.request.uri.path, \"/_next/image\"))"

  # Anonymous cache-eligible remainder = everything that is NOT one of the
  # bypass groups. Expressed as a SINGLE negation of an OR-group (De Morgan of
  # `not A and not B ...`) so it exactly mirrors the proven Rule 1 form and
  # avoids any `not`/`and` precedence ambiguity at the edge. Always excludes the
  # never-cache (PII) and image-optimizer paths; folds in the session-cookie
  # clause only when cookies are configured (else that OR-term is dropped so the
  # group stays valid).
  cache_bypass_group_expr = local.has_session_cookie ? "${local.never_cache_path_expr} or ${local.image_optimizer_path_expr} or ${local.session_cookie_expr}" : "${local.never_cache_path_expr} or ${local.image_optimizer_path_expr}"
  anonymous_cache_expr    = "not (${local.cache_bypass_group_expr})"

  # XHR / fetch API traffic vs top-level navigation. Sec-Fetch-Mode is set by all
  # modern browsers: "navigate" for page loads, "cors"/"no-cors"/"same-origin"
  # for fetch/XHR. API + XHR get JSON 429s; navigations get a Managed Challenge.
  is_navigation_expr = "(http.request.headers[\"sec-fetch-mode\"][0] eq \"navigate\")"
  is_api_or_xhr_expr = "(starts_with(http.request.uri.path, \"/api/\") or http.request.headers[\"sec-fetch-mode\"][0] in {\"cors\" \"no-cors\" \"same-origin\"})"
}
