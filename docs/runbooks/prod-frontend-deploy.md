# Runbook — Prod frontend deploy & redeploy (grove-*-prod)

**Owner:** DevOps (Terra) · **Issue:** GOL-1600 · **Incident it codifies:** GOL-1607 (2026-08-17 prod-stale outage)

> **Consolidated 2026-08-20** with odoocker PR #522 (`docs/RUNBOOK-storefront-release.md`,
> GOL-1325) — that doc and this one were written independently to solve the same
> problem. This is now the single canonical procedure; #522 is reduced to an
> Option-A-specific appendix that points back here. If you find a second copy of
> the deploy steps anywhere else, it's stale — this file plus
> `scripts/lib/do-app-redeploy.sh` are the only source of truth.

## The shape of prod frontends

All four prod frontends are DigitalOcean App Platform apps sourced from **GHCR**
(not a git build, despite what an old `infra/do/*.yaml` may say — see Drift note):

| App                  | App Platform ID                       | Public URL                        | Image                                          |
| --------------------- | -------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| grove-hub-prod        | `d5fa7795-da75-40e7-93fb-983e71558279` | https://gatheringatthegrove.com   | `ghcr.io/goldberry-playground/grove-hub`        |
| grove-goldberry-prod  | `3da0b924-85f6-4531-859f-699e03c3cd74` | https://goldberrygrove.farm       | `ghcr.io/goldberry-playground/grove-goldberry`  |
| grove-ggg-prod        | `30c2a739-97d2-43bf-a6f8-dfff4a318bd8` | https://woodworkingeorge.com      | `ghcr.io/goldberry-playground/grove-ggg`        |
| grove-nursery-prod    | `b9e0d2a6-6495-4dc7-a069-015b653c87e9` | https://atthegrovenursery.com     | `ghcr.io/goldberry-playground/grove-nursery`    |

QA counterparts pull from the same per-tenant GHCR repos. Under Option A, QA
tracks `latest` and prod is pinned to a reviewed SHA — QA's current build is the
image the *next* prod promotion will pull, not necessarily what prod is serving
right now.

## Two hard lessons (GOL-1607) — read before touching a prod app

### Lesson 1 — Pinning a tag deploys nothing on a GHCR-sourced app
App Platform's `image.deploy_on_push` is a **DOCR-only** feature. DO accepts it on
a GHCR spec and then silently ignores it. So moving the pinned tag (whether via a
new `:latest` push, `doctl apps update --spec`, or a `terraform apply` that only
changes the tag var) changes the *desired* state but never rolls it out. **You must
follow any pin change with an explicit `doctl apps create-deployment`.** Its
absence is what left all four prod frontends serving a stale build on 2026-08-17
with no error anywhere — and it is not just a 08-17 artifact: the same TF-applied-
but-never-redeployed gap was independently rediscovered live on 2026-08-20 (the
pin sat unrolled for two days after the Option A PR merged; see Validation record).

### Lesson 2 — Never fire create-deployment while one is in flight
Two `create-deployment` calls back-to-back on the same app make DO cancel/supersede
the in-progress rollout, and its auto-rollback then restores the **previous (stale)**
build — the exact thing you were replacing. Create **exactly one** deployment per
pin change, and only when no rollout is already running. Do not wrap it in a retry.

**This is not theoretical — it fired for real on QA on 2026-08-18** (GOL-1325
rehearsal): a `doctl apps create-deployment -o json` call whose stdout failed to
parse looked like a failure, a second `create-deployment` fired ~4s later, DO
canceled the first and marked it failed, and auto-rollback restored the stale
build — superseding both manual deploys. Root cause: piping `create-deployment`
through a JSON parser that can throw on empty/malformed stdout. **Capture the
deployment id with `--format ID --no-header`, never with a parser that can error.**
If a capture step errors, the deployment may already exist — check
`doctl apps list-deployments "$APP"` before deciding anything, and do **not**
re-fire.

Both lessons live in code so nobody relearns them: **`scripts/lib/do-app-redeploy.sh`**.

## How to redeploy a prod app (the only sanctioned way)

```bash
# doctl must be authenticated (DIGITALOCEAN_ACCESS_TOKEN in env).
scripts/lib/do-app-redeploy.sh grove-goldberry-prod
```

It resolves the app by name, refuses to act if a deployment is already in flight
(Lesson 2), then issues exactly one `doctl apps create-deployment --wait` (Lesson 1)
and prints the digest that went live. Exit codes: `0` deployed, `2` skipped (rollout
already running), `1` hard failure.

One-at-a-time discipline: deploy and verify one app fully before starting the
next, or run them in parallel only if you track each app's deployment id
independently. Do not loop `create-deployment` over a list without a per-app poll
gate.

## Verifying a build actually rolled (from odoocker #522 / GOL-1325)

A `doctl apps get-deployment` phase of `ACTIVE` proves the deployment mechanism
worked, not that the *right* build is now serving. Confirm with a build
fingerprint before declaring success:

```bash
fp() { curl -s --max-time 20 "$1/" \
  | grep -oE 'static/chunks/webpack-[a-f0-9]+\.js' | head -1; }

fp https://georgeggg.com                     # AFTER (prod)
fp https://ggg.qa.gatheringatthegrove.com    # QA == the build a redeploy just pulled
```

Pass criteria: the prod AFTER hash equals the QA hash (prod is now on the current
image). If `latest`/the pin hadn't advanced since prod's last deploy, the hash is
unchanged — that's still a valid pass; the *mechanism* is proven by the ACTIVE
deployment plus a hash that matches QA. A prod hash that differs from QA after
ACTIVE means the two are pulling different images — investigate before declaring
success. For a full-parity check, also compare the CSS chunk hash and the md5 of
the sorted `/_next/static/chunks/*.js` set.

Then smoke the public route:

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 20 https://georgeggg.com   # expect 200
```

## Promoting a new build (Option A — GOL-1304)

Prod pins each app to an immutable image SHA (not `:latest`) so prod serves a
deliberate, known build rather than auto-advancing on every merge. The promote
flow:

1. Bump the pinned image-tag var(s) (`hub_image_tag` / `tenant_image_tag` in
   `odoocker-goldberrygrove/infra/terraform/environments/production/variables.tf`)
   to the new SHA.
2. `terraform plan` (targeted to the four `digitalocean_app` resources) → review
   → `terraform apply` (updates the app spec — this alone is **not** a deploy,
   Lesson 1).
3. `source scripts/lib/do-app-redeploy.sh && do_app_redeploy <app>` per app — one
   deploy each, this is what actually rolls it.
4. Verify (fingerprint + smoke, above), notify Discord.

**Do not** add an automatic prod redeploy on every push to main — that defeats the
point of pinning. Promotion is deliberate: a human decides *when*, even once the
mechanics are automated end-to-end (see Automated promotion, below).

## Automated promotion — one-click, human-gated

`.github/workflows/promote-storefronts.yml` (odoocker-goldberrygrove) runs steps
1–4 above end-to-end from `workflow_dispatch`, so promoting no longer requires
running `terraform`/`doctl` by hand. It still requires one explicit human action:
the job runs under the `production` GitHub Environment, which pauses for a
required-reviewer approval before touching anything. Trigger it, review the
proposed SHA in the run summary, click Approve — the rest (pin bump, targeted
apply, four single-fire redeploys, fingerprint verification, Discord notify) runs
unattended. See that workflow's header comment for the full design and its
required secrets.

## The alarm — `.github/workflows/prod-deploy-drift.yml`

Runs every 30 min (and on demand). For each prod app it compares the digest the app
is **actually serving** (`active_deployment.services[].source_image_digest`) against
the digest its pinned tag **resolves to on GHCR right now**. Any mismatch — or a
non-`ACTIVE` deployment phase — posts a Discord ops alarm and reds the run. Read-only;
it never deploys. This is the alarm 08-17 lacked.

⚠️ Do not trust a stale "last verified" claim in this doc over the workflow's own
run history — check
[recent runs](https://github.com/Goldberry-Playground/grove-sites/actions/workflows/prod-deploy-drift.yml)
directly. (An earlier revision of this file claimed "verified live 2026-08-18: all
four apps OK" — true at the moment it was written, false for the two days after,
because the Option A pin PR merged without a following `terraform apply`. A doc
claim is a snapshot, not a guarantee; the workflow run history is ground truth.)

## Drift note — codified spec vs live spec

As of 2026-08-18 `infra/do/*.yaml` still describe **git-sourced** apps, but the live
prod apps are **GHCR-sourced**. The drift monitor above catches *serving-vs-pin* drift;
reconciling the committed specs to the live GHCR model is tracked separately (GOL-1304
pinning + follow-up). Until then, treat GHCR as the source of truth for what prod runs.

## Validation record

- **2026-08-18 — QA rehearsal (GOL-1325):** exercised the redeploy + fingerprint-
  verify steps against `grove-ggg-qa`. Single `create-deployment`, polled to
  ACTIVE, fingerprint verified. Also where the Lesson 2 double-deploy trap
  reproduced live (see above) — confirms the guard in
  `scripts/lib/do-app-redeploy.sh` is load-bearing, not theoretical.
- **2026-08-20 — first real prod promotion under Option A:** `#536` (pin +
  disable `deploy_on_push`) merged 2026-08-18 but was not `terraform apply`'d
  against prod until 2026-08-20 — two days of the pin being declared-but-not-live,
  caught by the drift alarm going red on every scheduled run in that window.
  Applied (targeted to the four app resources) and redeployed all four apps
  2026-08-20; confirms the manual chain works end-to-end and is the direct
  motivation for the automated promotion workflow above.
