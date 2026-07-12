# Tier 1 §4 — the custom-phase entrypoint ruleset (`http_request_firewall_custom`).
#
# IMPORTANT — Cloudflare allows exactly ONE entrypoint ruleset per phase per zone.
# Each storefront zone already HAS one, named "Grove edge policy", carrying the
# GOL-44 CN/RU block. So we do NOT create a second ruleset — we IMPORT the
# existing one into this resource (README import runbook) and manage BOTH rules
# in it:
#   Rule 1 (FIRST) — §4 allowlist `skip`: verified crawlers, payment webhooks,
#                    monitoring, unfurlers/scanners bypass the rest of this phase.
#   Rule 2         — the EXISTING CN/RU block, reproduced byte-for-byte so the
#                    import is no-drift. Phase 1 keeps this as-is; it is NOT a new
#                    geo rule (that's Phase 2), and we do not remove it.
#
# Rule order matters: the allowlist is first so a verified client is never caught
# by the geo block. Name is pinned to "Grove edge policy" to match the live
# ruleset and avoid a cosmetic rename diff on import.
#
# Free-tier note: the `skip` action with `ruleset = "current"` (skip the rest of
# THIS ruleset) is available on all plans. We deliberately do NOT skip other
# phases/products here — cross-phase skip is a paid-plan feature and would 400 on
# Free. On Free the bot layer is Bot Fight Mode, which already allows verified
# bots on its own, so the allowlist's job here is purely to keep trusted clients
# out of the geo block and any future custom rules.

locals {
  # Social unfurlers + email link-scanners: UA-matched (not CF-verified bots) but
  # must fetch a URL for a preview/scan without being blocked. Reconcile with
  # GOL-44 doc §4 before widening.
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
    "Barracuda", # email security scanners
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

  # Reproduce the EXISTING CN/RU block expression exactly: (ip.geoip.country in {"CN" "RU"})
  geo_block_expr = "(ip.geoip.country in {${join(" ", [for c in var.geo_block_countries : "\"${c}\""])}})"
}

resource "cloudflare_ruleset" "custom_firewall" {
  count = var.custom_firewall_mode == "off" ? 0 : 1

  zone_id = var.zone_id
  name    = "Grove edge policy" # matches the live entrypoint ruleset name
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  # RULE 1 (FIRST) — §4 allowlist skip. Trusted clients bypass the rest of this
  # ruleset (the geo block below + any future custom rules).
  rules {
    ref         = "grove_allowlist_skip"
    description = "Allowlist FIRST: verified bots, payment webhooks, monitoring, unfurlers/scanners (${var.zone_name})"
    expression  = local.allowlist_expr
    action      = "skip"
    enabled     = true

    action_parameters {
      ruleset = "current"
    }

    logging {
      enabled = true
    }
  }

  # RULE 2 — EXISTING GOL-44 CN/RU block, preserved verbatim for a no-drift
  # import. Not a new geo rule; do not remove.
  rules {
    ref         = "grove_geo_block_cnru"
    description = "Block CN+RU traffic (bot/scanner noise; no legitimate audience)"
    expression  = local.geo_block_expr
    action      = "block"
    enabled     = true
  }
}
