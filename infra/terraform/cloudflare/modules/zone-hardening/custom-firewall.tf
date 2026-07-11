# Tier 1 §4 — Allowlist as a `skip` rule ordered FIRST in the custom phase
# (`http_request_firewall_custom`).
#
# Rules in this phase evaluate top-down. Placing the allowlist first and having
# it `skip` the downstream mitigating phases means verified crawlers, payment
# webhooks, monitoring, email link-scanners and social unfurlers are NEVER
# rate-limited, challenged, or WAF-blocked — no matter what the later tiers do.
# This is the single most important ordering guarantee in the whole design, so
# it lives in its own first rule.
#
# An allowlist only ever REDUCES friction, so it is safe to keep active even
# while other layers soak in log mode; `custom_firewall_mode` only gates whether
# the ruleset exists at all ("off" => not created).
#
# Trust model per §4:
#   - Verified crawlers  -> `cf.client.bot` (Cloudflare-verified, spoof-resistant;
#                           NOT a UA-string match).
#   - Payment webhooks   -> matched by exact PATH; signature verification stays
#                           the app's job (never IP-allowlisted).
#   - Monitoring         -> shared-secret HEADER (path+header, not IP).
#   - Email scanners /
#     social unfurlers   -> UA list (these clients don't run JS / can't solve a
#                           challenge, so a link preview or scan would break).
#                           UA list must be reconciled against GOL-44 doc §4.

locals {
  # Social unfurlers + email link-scanners. These are UA-string matched because
  # they are not Cloudflare-verified bots but must still fetch a URL for a
  # preview/scan without hitting a challenge. Reconcile with doc §4 before "on".
  unfurler_ua_substrings = [
    "facebookexternalhit",
    "Twitterbot",
    "Slackbot",
    "Discordbot",
    "LinkedInBot",
    "WhatsApp",
    "TelegramBot",
    "Pinterest",
    "redditbot",
    "Applebot",  # Siri/Spotlight link previews
    "Barracuda", # email security scanners below
    "Proofpoint",
    "Mimecast",
    "Microsoft-Preview",
  ]

  ua_match_expr = join(" or ", [
    for ua in local.unfurler_ua_substrings :
    "http.user_agent contains \"${ua}\""
  ])

  webhook_path_expr = join(" or ", [
    for p in var.payment_webhook_paths :
    "http.request.uri.path eq \"${p}\""
  ])

  monitoring_expr = "(http.request.headers[\"${var.monitoring_secret_header_name}\"][0] eq \"${var.monitoring_secret_header_value}\")"

  allowlist_expr = join(" or ", compact([
    "(cf.client.bot)",
    "(${local.webhook_path_expr})",
    var.monitoring_secret_header_value != "" ? local.monitoring_expr : "",
    "(${local.ua_match_expr})",
  ]))
}

resource "cloudflare_ruleset" "custom_firewall" {
  count = var.custom_firewall_mode == "off" ? 0 : 1

  zone_id = var.zone_id
  name    = "grove-tier1-custom-firewall"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  # RULE 1 (FIRST) — allowlist skip. Skips the remaining custom rules AND the
  # downstream mitigating phases/products for verified/trusted clients.
  rules {
    ref         = "grove_allowlist_skip"
    description = "Allowlist FIRST: verified bots, payment webhooks, monitoring, unfurlers/scanners (${var.zone_name})"
    expression  = local.allowlist_expr
    action      = "skip"
    enabled     = true

    action_parameters {
      # Skip the rest of this custom phase...
      ruleset = "current"
      # ...and the downstream mitigation phases for these trusted clients.
      phases = [
        "http_ratelimit",
        "http_request_firewall_managed",
        "http_request_sbfm",
      ]
      # ...and the legacy security products (Bot Fight Mode / security level /
      # UA rules / browser integrity check) so a verified client is never caught
      # by a non-ruleset mitigation either.
      products = [
        "bic",
        "hot",
        "rateLimit",
        "securityLevel",
        "uaBlock",
        "waf",
        "zoneLockdown",
      ]
    }

    logging {
      enabled = true
    }
  }
}
