# Grove Preview pipeline — operator reference

Three workflows implement the per-PR preview environment (GOL-6, M3):

| Workflow | Trigger | What it does |
|---|---|---|
| `preview-up.yml`   | PR labeled `qa` (or push to a labeled PR) | Builds 4 frontend images at the PR SHA, `terraform apply` the odoocker `preview/` env → droplet + DNS + firewall + full Compose stack, comments per-tenant URLs. |
| `preview-down.yml` | PR closed / merged / `qa` label removed | `terraform destroy` the per-PR state — droplet, DNS, firewall. |
| `preview-sweep.yml`| Scheduled (every 6h) + manual | Lists `env-preview` droplets, destroys any whose PR is closed / unlabeled / idle past the TTL / older than the 7-day budget. Safety net for missed teardowns + the scale-to-zero reaper. |

The Terraform lives in **odoocker** at `infra/terraform/environments/preview/` (M2). These workflows are the CI drivers; they check that repo out at run time.

## Scale-to-zero: when a preview dies (GOL-255)

A preview droplet costs ~$0.033/hr, so nothing is allowed to linger. Four
independent things can reap one — the first to fire wins:

| Reason | Fires when | Re-checked before destroy against |
|---|---|---|
| PR closed / merged | immediately, via `preview-down.yml` | — |
| `qa` label removed | immediately, via `preview-down.yml` | — |
| **Idle TTL** | sweep sees an open + `qa` PR with **no deploy activity for 24h** | the activity clock (a push since the scan saves it) |
| **Age budget** | sweep sees a droplet older than **7 days**, regardless of PR state | nothing — the cap is absolute |

**"Activity" means a deploy, not a conversation.** The idle clock is the newest
of (a) the head commit's timestamp and (b) the last `preview-up` run on that
branch. PR `updated_at` is deliberately *not* used — a bot comment would keep a
dead preview alive forever.

**Fail-safe:** every ambiguity keeps the droplet. Unresolvable timestamps, an
in-flight `preview-up`/`preview-down`, or a PR that revived between scan and
destroy all defer to the next sweep (≤6h). We would rather pay for a droplet
than kill a preview someone is reviewing.

**Getting a reaped preview back:** push a commit, or remove and re-add the `qa`
label. The sweep comments on the PR whenever it reaps a still-open PR's preview,
so the URLs never go dead silently.

**Tuning:** `workflow_dispatch` takes `idle_ttl_hours` (default `24`, set `0` to
disable idle reaping) and `max_age_days` (default `7`), plus `dry_run` to report
without destroying. Change the defaults in `preview-sweep.yml` to make them
permanent.

## Authentication — no static DIGITALOCEAN_TOKEN

Per ADR-0001 Phase 3 (retiring Infisical), all runtime secrets are resolved
from **1Password** at job start via `1password/load-secrets-action@v2`,
authenticated by the read-only `grove-ci-prod-ro` service account. There is
**no static `DIGITALOCEAN_TOKEN`** stored in GitHub secrets — satisfying
GOL-6's "OIDC-federated / no static token" requirement with the org's current
canonical mechanism (a scoped SA token, not GitHub OIDC federation, because
DigitalOcean has no OIDC trust for its API tokens and 1Password's SA model
supersedes the earlier Infisical-OIDC bridge).

### Required GitHub repo secret (one)

| Secret | Value |
|---|---|
| `OP_CI_SA_TOKEN` | Service-account token for `grove-ci-prod-ro` (read-only to the `Grove Prod` 1Password vault). Same SA used by odoocker's `terraform-drift.yml`. |

This is the **only** GitHub Actions secret grove-sites needs for the preview
pipeline. Provisioning it is tracked in the secrets-wiring child issue (needs
`secrets:write` on the repo — board/CEO owns that grant).

### Required 1Password items (`Grove Prod` vault)

Shared infra creds already exist under the **`odoocker`** item (reused as-is):

- `odoocker/DIGITALOCEAN_TOKEN`
- `odoocker/SPACES_ACCESS_KEY_ID`
- `odoocker/SPACES_SECRET_ACCESS_KEY`
- `odoocker/DISCORD_OPS_WEBHOOK_URL`

Preview-only creds go under a new **`grove-preview`** item (create these):

- `grove-preview/GHOST_KEY_GOLDBERRY` — prod Ghost Content API key (read-only)
- `grove-preview/GHOST_KEY_GGG`
- `grove-preview/GHOST_KEY_NURSERY`
- `grove-preview/PREVIEW_SSH_KEY_ID` — fingerprint of the DO-registered SSH key (operator debug access)
- `grove-preview/ADMIN_IP_CIDR` — CIDR allowed to SSH into preview droplets (port 22)

If any preview-only value should instead be sourced from an existing item,
update the `op://` refs in the three workflow files to match — they are the
single source of truth for the paths.

## Acceptance (GOL-6)

1. Open a PR, add the `qa` label → `preview-up` builds + provisions → a
   "🌱 Grove preview environment" comment appears with per-tenant URLs, each
   resolving under `*.pr-<N>-<5char>.preview.gatheringatthegrove.com`.
2. Close the PR (or remove `qa`) → `preview-down` destroys the droplet, DNS,
   firewall; the URLs comment is struck through.
3. `preview-sweep` (manual `dry_run: true` to preview) reports/reaps any
   droplet whose PR is no longer an open `qa` PR.

End-to-end verification is gated on the secret provisioning above; the
workflow logic and the odoocker TF env are complete and reviewable now.
