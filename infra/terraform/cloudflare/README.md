# Grove Cloudflare Edge Hardening (Terraform) — GOL-264 Phase 1

Codifies the storefront zones' Cloudflare WAF / bot / cache / rate-limit config
as Terraform. Implements **Phase 1** of the CEO-approved GOL-44 recommendation
(approved 2026-07-04). **No new country/geo rule** — that is Phase 2, a separate
data-gated approval.

> **Current-state finding:** before this module, the storefront zones' CF config
> was **click-ops in the dashboard** — nothing was in Terraform (grove-sites
> `infra/` had only `do/nginx/scripts`; AgenticOS TF manages only AgenticOS
> infra). So this is a **codify-from-scratch** root, not an edit. The import
> runbook below is therefore mandatory: we import existing state FIRST and prove
> a no-drift `plan` before changing anything.

## Layout

```
cloudflare/
├── versions.tf          # TF >=1.6, cloudflare ~> 4.40 (NOT v5), s3/Spaces backend (grove-tf-state)
├── providers.tf         # cloudflare provider (scoped API token)
├── variables.tf         # token, account_id, zones map, plan_tier, rollout toggles, allowlist inputs
├── zones.tf             # module "zone_hardening" for_each over the 7 zones
├── outputs.tf
├── terraform.tfvars.example
├── .env.op              # 1Password op:// references (committed; no secret values)
├── .gitignore
└── modules/zone-hardening/
    ├── variables.tf     # per-zone inputs + shared expression locals
    ├── waf-managed.tf   # Tier 0: Cloudflare Managed WAF ruleset
    ├── cache-rules.tf   # Tier 0: cookie-aware Cache Rules
    ├── bot-management.tf# Tier 0: BFM (free) / SBFM (pro|business) — plan-tier gated
    ├── rate-limit.tf    # Tier 1: expensive-path rate limits, client-type split
    ├── custom-firewall.tf # Tier 1 §4: allowlist skip rule ordered FIRST
    └── outputs.tf
```

## ⛔ Blocked inputs (unblock owner: CEO Rick — CF account holder)

Nothing here can `import`/`plan`/`apply` until these land in the DevOps secret
store (durable mechanism = the secrets pipeline, **GOL-88**):

1. **Scoped CF API token** — `Zone:Read`, `Zone WAF:Edit`,
   `Firewall Services:Edit`, `Cache Rules:Edit` on the storefront account. Store
   in 1Password at the ref in `.env.op` (`Grove Cloudflare/storefront_api_token`).
2. **Account ID + the 7 zone IDs** — populate `terraform.tfvars` (see
   `terraform.tfvars.example`).
3. **Plan tier** — `free` | `pro` | `business` | `enterprise`. Decides the bot
   layer (BFM vs SBFM). Set `plan_tier` and only then flip `enable_bot_management`.

The token also needs the `grove-tf-state` Spaces bucket key (AWS_* in `.env.op`).
If that bucket doesn't exist yet, bootstrap it exactly like AgenticOS's
`state-backend/` module (separate estate, blast-radius isolation).

## Secret injection

Never pass the token on the CLI or in tfvars. Use 1Password `op run`:

```bash
cd infra/terraform/cloudflare
cp terraform.tfvars.example terraform.tfvars   # fill account_id + zone_ids + plan_tier
op run --env-file=.env.op -- terraform init
op run --env-file=.env.op -- terraform plan
```

## Import runbook (do this BEFORE any apply)

The zones already exist and (probably) already carry the click-ops CN/RU rule
from GOL-44. Import so `plan` is clean/no-drift before we add anything.

1. **Init** against the remote backend (creds from `.env.op`).
2. **Zones are data, not managed here** — this root does not manage
   `cloudflare_zone` resources (it only attaches rulesets to existing zones), so
   there's nothing to import for the zones themselves; you just supply their IDs.
3. **Import the existing rulesets per zone.** Rulesets are addressed by
   `<zone_id>/<ruleset_id>`. List them first:
   ```bash
   # per zone, find existing custom-phase + ratelimit rulesets:
   curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets" | jq '.result[] | {id,phase,name}'
   ```
   If the existing CN/RU rule lives in the `http_request_firewall_custom` phase,
   import that ruleset into this module's `custom_firewall` address and
   reconcile the rule in HCL (Phase 1 keeps the CN/RU rule as-is — we do NOT
   remove it and do NOT add a new geo rule):
   ```bash
   op run --env-file=.env.op -- terraform import \
     'module.zone_hardening["woodworking"].cloudflare_ruleset.custom_firewall[0]' \
     "$ZONE_ID/$RULESET_ID"
   ```
4. **`plan` must be clean** (0 add / 0 change / 0 destroy for imported objects)
   before you enable any new tier. If the plan wants to destroy/replace the CN/RU
   rule, STOP and reconcile the HCL to match the live rule first.

> The committed module defaults (`waf_managed_enabled=true`, `cache_rules_enabled=true`)
> WILL show as adds on first plan because they're new rulesets — that's expected
> and is the actual Tier 0 change. "No-drift" applies to the **imported** CN/RU
> rule, not to the net-new tiers.

## Rollout order (§6) — log-first, lowest-traffic-first

All mitigating layers default to **log/off** so the first apply is provably
non-disruptive. Advance ONE layer per reviewed PR, observing WAF events + RUM
**48–72h** between steps:

| Step | Change | Safety |
|------|--------|--------|
| 0 | `terraform apply` Tier 0 WAF + cache rules | Managed WAF actions are CF-tuned (log/challenge); cache rules are default-bypass |
| 1 | `rate_limit_mode = "log"` → soak → `"on"` | Rate-limit has a real log mode |
| 2 | `custom_firewall_mode` allowlist active (always safe — only reduces friction) | Allowlist can't add friction |
| 3 | `enable_bot_management = true` — **starts on `woodworkingeorge.com` only** | BFM (free) has NO log mode, so lowest-traffic zone leads; widen after soak |

Bot layer scoping is enforced in `zones.tf`: `enable_bot_management && rollout_first`,
so flipping the global switch only touches the `rollout_first` zone. Widen by
editing that condition after the first zone soaks clean.

### Break-glass

If a layer misfires: revert the toggle in a PR **and pause CI auto-apply** so a
scheduled/drift apply can't re-assert it. Because state is remote and shared, a
manual dashboard rollback creates drift — prefer `terraform apply` of the
reverted toggle. Document any emergency dashboard change and re-import.

## Done bar (GOL-264)

- `terraform plan` clean after import (imported CN/RU rule shows no drift).
- Tiers land as reviewed PR(s).
- No interactive challenge on any `/api/*` path — by design, `/api/*` + XHR get
  **Block → 429/JSON**, never a challenge (verify cart/search works for a
  simulated non-US navigation-challenged session).
- No storefront page served from full-page cache (cookie-aware bypass +
  never-cache `/checkout|/account|/cart|/api/*`).

## Notes / follow-ups

- **Session cookie name** in `modules/zone-hardening/variables.tf` `session_cookie_expr`
  is a best-guess set — confirm the real storefront session/cart cookie name(s)
  with Engineering - Alice and tighten before enabling cache rules in prod.
- **Unfurler/scanner UA list** in `custom-firewall.tf` must be reconciled against
  GOL-44 doc §4.
- **`cloudflare ~> 4.40` is pinned deliberately.** Do not bump to v5 in this task.
