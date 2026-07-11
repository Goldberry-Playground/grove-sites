# Tier 1 — rate limiting on expensive paths (`http_ratelimit` phase), with a
# client-type split:
#   /api/* + XHR   -> Block, returning a JSON 429 (machine clients parse JSON,
#                     not an HTML challenge page).
#   navigation     -> Managed Challenge (a human page load can solve a challenge;
#                     a 429 would look like a hard outage).
#
# Rollout is log-first (§6): in "log" mode both rules use action="log" so we see
# who WOULD be limited over a 48-72h soak before any mitigation. Flip
# rate_limit_mode="on" in a reviewed PR once the WAF-events data is clean.
#
# "Expensive paths": search + API endpoints, which do real origin/DB work. Static
# and cached marketing paths are excluded — they're absorbed by cache Tier 0.

locals {
  # Paths worth protecting from bursty abuse.
  expensive_path_expr = "(starts_with(http.request.uri.path, \"/api/\") or starts_with(http.request.uri.path, \"/search\") or http.request.uri.query contains \"q=\")"

  rl_api_action = var.rate_limit_mode == "on" ? "block" : "log"
  rl_nav_action = var.rate_limit_mode == "on" ? "managed_challenge" : "log"
}

resource "cloudflare_ruleset" "rate_limit" {
  count = var.rate_limit_mode == "off" ? 0 : 1

  zone_id = var.zone_id
  name    = "grove-tier1-rate-limit"
  kind    = "zone"
  phase   = "http_ratelimit"

  # Rule 1 — API + XHR: block with JSON 429.
  rules {
    ref         = "grove_rl_api_xhr"
    description = "Rate-limit /api + XHR on expensive paths -> 429/JSON (${var.zone_name})"
    expression  = "${local.expensive_path_expr} and ${local.is_api_or_xhr_expr}"
    action      = local.rl_api_action
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 120
      mitigation_timeout  = 600
    }

    # Custom JSON body only applies when the action is a real block; harmless
    # (ignored) when action=log during the soak.
    dynamic "action_parameters" {
      for_each = local.rl_api_action == "block" ? [1] : []
      content {
        response {
          status_code  = 429
          content_type = "application/json"
          content      = "{\"error\":\"rate_limited\",\"retry_after\":600}"
        }
      }
    }
  }

  # Rule 2 — navigation page loads: Managed Challenge.
  rules {
    ref         = "grove_rl_navigation"
    description = "Rate-limit navigation loads on expensive paths -> Managed Challenge (${var.zone_name})"
    expression  = "${local.expensive_path_expr} and ${local.is_navigation_expr}"
    action      = local.rl_nav_action
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 200
      mitigation_timeout  = 600
    }
  }
}
