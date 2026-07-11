# Tier 0 — bot layer. The concrete resource shape is PLAN-TIER DEPENDENT, which
# is exactly why enable_bot_management defaults OFF until CEO Rick confirms the
# tier (GOL-264 scope item 1). Rather than send tier-invalid attributes, we split
# into two count-gated resources — only one can ever be active per zone:
#
#   free            -> Bot Fight Mode (fight_mode). Global on/off, NOT scopeable,
#                      and it has NO log mode — so per §6 the rollout goes
#                      lowest-traffic-zone-first (woodworkingeorge.com), which is
#                      enforced upstream in zones.tf (rollout_first gate).
#   pro / business  -> Super Bot Fight Mode (sbfm_* actions). Scopeable, respects
#                      the §4 allowlist skip (http_request_sbfm phase), verified
#                      bots allowed. Preferred if the plan supports it.
#
# Enterprise (full Bot Management with ML score fields) is intentionally not
# implemented here — this storefront estate is not expected to be Enterprise; if
# it is, add a third gated resource in a follow-up rather than guessing fields.

# ── Free: Bot Fight Mode ─────────────────────────────────────────────────────
resource "cloudflare_bot_management" "bfm" {
  count = var.enable_bot_management && var.plan_tier == "free" ? 1 : 0

  zone_id    = var.zone_id
  fight_mode = true
}

# ── Pro / Business: Super Bot Fight Mode ─────────────────────────────────────
resource "cloudflare_bot_management" "sbfm" {
  count = var.enable_bot_management && contains(["pro", "business"], var.plan_tier) ? 1 : 0

  zone_id = var.zone_id

  # Challenge (not block) automated traffic so a false positive is recoverable
  # by a real user; allow verified bots (search crawlers) outright — the §4
  # allowlist also skips the http_request_sbfm phase for them as defense in depth.
  sbfm_definitely_automated       = "managed_challenge"
  sbfm_likely_automated           = "managed_challenge"
  sbfm_verified_bots              = "allow"
  sbfm_static_resource_protection = false
  optimize_wordpress              = false
  enable_js                       = true
}
