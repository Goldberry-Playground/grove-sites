# Tier 0 — cookie-aware Cache Rules (`http_request_cache_settings` phase).
#
# Goal: cache ONLY anonymous marketing/listing/Ghost responses at the edge, and
# NEVER serve a storefront page that could carry session/PII from full-page
# cache. Rules evaluate top-down; first match wins.
#
#   Rule 1 — hard bypass for dynamic/PII paths (/checkout|/account|/cart|/api/*),
#            regardless of cookies. Belt-and-suspenders vs origin cache headers.
#   Rule 2 — bypass cache whenever a session cookie is present (logged-in / has
#            cart), so a personalized response is never cached or served shared.
#   Rule 3 — everything else (anonymous, no session cookie): eligible to cache,
#            respecting origin TTLs. This is the marketing/Ghost/listing content.
#
# This is intentionally conservative: default-bypass with a narrow cache-eligible
# tail, not default-cache with holes. Meets the done-bar "no storefront page
# served from full-page cache."

resource "cloudflare_ruleset" "cache_rules" {
  count = var.cache_rules_enabled ? 1 : 0

  zone_id = var.zone_id
  name    = "grove-tier0-cache-rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  # Rule 1 — never cache dynamic / PII paths.
  rules {
    ref         = "grove_cache_bypass_dynamic"
    description = "Never cache /checkout|/account|/cart|/api/* (${var.zone_name})"
    expression  = local.never_cache_path_expr
    action      = "set_cache_settings"
    enabled     = true

    action_parameters {
      cache = false
    }
  }

  # Rule 2 — bypass cache when a session cookie is present.
  rules {
    ref         = "grove_cache_bypass_session"
    description = "Bypass cache for requests carrying a session cookie (${var.zone_name})"
    expression  = local.session_cookie_expr
    action      = "set_cache_settings"
    enabled     = true

    action_parameters {
      cache = false
    }
  }

  # Rule 3 — anonymous remainder: cacheable, respect origin TTLs.
  rules {
    ref         = "grove_cache_anonymous"
    description = "Cache anonymous marketing/listing/Ghost responses, respect origin (${var.zone_name})"
    expression  = "not ${local.never_cache_path_expr} and not ${local.session_cookie_expr}"
    action      = "set_cache_settings"
    enabled     = true

    action_parameters {
      cache = true
      edge_ttl {
        mode = "respect_origin"
      }
      browser_ttl {
        mode = "respect_origin"
      }
    }
  }
}
