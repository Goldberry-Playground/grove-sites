# Grove Cloudflare Edge Hardening (Terraform) — GOL-264 Phase 1

Codifies the storefront zones' Cloudflare WAF / bot / cache config as Terraform.
Implements **Phase 1** of the CEO-approved GOL-44 recommendation (approved
2026-07-04). **No new country/geo rule** — the existing CN/RU block is preserved
as-is; a new geo rule is Phase 2 (separate, data-gated).

> **Current-state finding:** before this module, the storefront zones' CF config
> was **click-ops in the dashboard** (grove-sites `infra/` had only
> `do/nginx/scripts`). This is a **codify-from-scratch** root. The import runbook
> below is mandatory: import the existing state FIRST and prove a no-drift `plan`
> before changing anything.

## Real inventory (confirmed live 2026-07-11)

Queried via the CF API: **4 zones, all Free tier, one account
`5579f08c66e73a09ceb7855a19b14e11`.** (The GOL-264 ticket's original 7-zone list
was wrong; `atthegrove.com`, `georgeggg.com`, `woodworkinggeorge.com` are NOT in
this CF account — pending CEO confirmation of where they resolve.)

| zone | zone_id | plan | existing "Grove edge policy" custom ruleset |
|---|---|---|---|
| goldberrygrove.farm | `0c31404bc38c968a66b302bb99e9fad3` | Free | `1a2733d760eb4df7b6cf7455fc6e5013` |
| atthegrovenursery.com | `939fd63eb2cadd07d57aa193fd543764` | Free | `030501e1064f4b69bb497b11602a20ea` |
| gatheringatthegrove.com | `04ca33af08b2671402393a444da0e698` | Free | `4d1496853c134d6d9e592dcde5cb5009` |
| woodworkingeorge.com (rollout-first) | `ea21ae31a73f7098ba6f962f8f10561a` | Free | `6b94b5e1ae304d41a5ff3de24c627f94` |

## What Free tier means for Phase 1 (board-accepted: ship Free subset, defer Pro)

- **Full Managed WAF is Pro+** → gated OFF here (`waf-managed.tf`). Free zones get
  the fixed, auto-on "Cloudflare Managed Free Ruleset" (id `77454fe2…`, already
  active, not Terraform-manageable).
- **Advanced rate limiting is Pro+** → gated OFF here (`rate-limit.tf`). Free
  allows only one basic rule with none of the client-type-split controls.
- **Shipping on Free:** Bot Fight Mode + cookie-aware **Cache Rules** + the §4
  **allowlist** folded into the existing "Grove edge policy" ruleset (one custom
  entrypoint ruleset per zone — CF allows only one, so we import + extend it).

All `plan_tier`-gated resources auto-activate if a zone is later upgraded to Pro.

## Layout

```
cloudflare/
├── versions.tf          # TF >=1.6, cloudflare ~> 4.40 (NOT v5), s3/Spaces backend (grove-tf-state)
├── providers.tf         # cloudflare provider (scoped API token)
├── variables.tf         # token, account_id, zones map, plan_tier, toggles, allowlist + geo inputs
├── zones.tf             # module "zone_hardening" for_each over the zones map
├── terraform.tfvars.example  # the REAL 4-zone inventory
├── .env.op / .gitignore
└── modules/zone-hardening/
    ├── waf-managed.tf   # Tier 0 Managed WAF — gated OFF on Free
    ├── cache-rules.tf   # Tier 0 cookie-aware Cache Rules — Free OK
    ├── bot-management.tf# Tier 0 BFM(free)/SBFM(pro+) — plan-tier gated
    ├── rate-limit.tf    # Tier 1 advanced rate limits — gated OFF on Free
    ├── custom-firewall.tf # Tier 1 §4: single entrypoint ruleset = allowlist skip FIRST + preserved CN/RU block
    └── variables.tf / outputs.tf / versions.tf
```

## Credentials (already provisioned)

The storefront CF creds already live in 1Password `Grove Infra` (Admin vault) —
no token to mint. Inject via `op run`:

```bash
cd infra/terraform/cloudflare
cp terraform.tfvars.example terraform.tfvars
op run --env-file=.env.op -- terraform init
op run --env-file=.env.op -- terraform plan
```

> **Which token:** ruleset read/import/plan requires **`account_cloudflare_api_token`**
> (verified live — reads all 4 zones' rulesets). The `cloudflare_zone_edit_token`
> verifies but returns auth-error 10000 on the rulesets API (no WAF read), so it is
> NOT usable here. `.env.op` points `TF_VAR_cloudflare_api_token` at the account
> token. Confirm it also has WAF/Cache **write** before the apply step (below).

## Import runbook (do this BEFORE any apply)

Each zone already has its "Grove edge policy" custom ruleset (the GOL-44 CN/RU
block). Import so `plan` is no-drift before adding the allowlist.

1. `terraform init` (creds from `.env.op`).
2. **Import the existing custom-phase ruleset per zone.** The v4 provider import
   ID is `zone/<zone_id>/<ruleset_id>` (note the `zone/` prefix):
   ```bash
   op run --env-file=.env.op -- terraform import \
     'module.zone_hardening["woodworking"].cloudflare_ruleset.custom_firewall[0]' \
     'zone/ea21ae31a73f7098ba6f962f8f10561a/6b94b5e1ae304d41a5ff3de24c627f94'
   # ...repeat for goldberry_farm / nursery / gathering with the IDs in the table above.
   ```
3. **Verify the CN/RU rule is byte-exact (no-drift).** `custom-firewall.tf`
   reproduces it from `var.geo_block_countries = ["CN","RU"]`. This was proven
   live 2026-07-11: importing the gathering ruleset with the CN/RU rule alone →
   `terraform plan` = **"No changes."** After import, the only diff `plan` should
   show on the custom ruleset is the **added allowlist skip rule** (ordered
   first) — that is the intended Tier-1 §4 change, not drift.
4. `cache_rules` is a NEW ruleset (no cache entrypoint exists yet) → it shows as
   an add. Expected.

## Rollout order (§6) — log-first, lowest-traffic-first

Free-tier subset, advanced one reviewed PR at a time, watching WAF events + RUM
48–72h between steps. **Apply is board-gated** (production edge change).

| Step | Change | Notes |
|------|--------|-------|
| 0 | Import the 4 custom rulesets (no-drift) | proven clean |
| 1 | `cache_rules_enabled = true` | cookie-aware bypass; never-cache `/checkout|/account|/cart|/api/*` |
| 2 | `custom_firewall_mode = "on"` — allowlist skip added first, CN/RU block preserved | allowlist only reduces friction |
| 3 | `enable_bot_management = true` — **starts on `woodworkingeorge.com` only** (BFM has no log mode) | widen after soak |

Bot scoping is enforced in `zones.tf` (`enable_bot_management && rollout_first`).

### Break-glass

If a layer misfires: revert the toggle in a PR **and pause CI auto-apply** so a
drift/scheduled apply can't re-assert it. State is remote+shared, so prefer a
`terraform apply` of the reverted toggle over a manual dashboard rollback (which
creates drift); document + re-import any emergency dashboard change.

## Verification status (2026-07-11)

- ✅ `terraform fmt` clean; `terraform validate` passes against the real
  cloudflare v4.40 provider schema (lock resolves 4.52.8, still v4).
- ✅ **Live no-drift import proven:** imported gathering's "Grove edge policy"
  ruleset → `plan` = "No changes" (exit 0).
- ✅ **Free gating proven:** module plan for a Free zone = exactly `cache_rules` +
  `custom_firewall` (2 add), no Managed WAF, no rate-limit.
- ⏳ Apply / staged rollout — board-gated (§6).

## Notes / follow-ups

- **Session cookie name** in `modules/zone-hardening/variables.tf`
  `session_cookie_expr` is a best-guess set — confirm the real storefront cookie
  name(s) with Engineering - Alice before enabling cache rules in prod.
- **Unfurler/scanner UA list** in `custom-firewall.tf` — reconcile with GOL-44 §4.
- **`grove-tf-state` Spaces bucket** must exist for the remote backend; bootstrap
  it like AgenticOS `state-backend/` if absent (the live proofs above used a
  throwaway local backend).
- **`cloudflare ~> 4.40` is pinned deliberately.** Do not bump to v5 in this task.
