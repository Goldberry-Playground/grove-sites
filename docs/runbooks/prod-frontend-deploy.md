# Runbook — Prod frontend deploy & redeploy (grove-*-prod)

**Owner:** DevOps (Terra) · **Issue:** GOL-1600 · **Incident it codifies:** GOL-1607 (2026-08-17 prod-stale outage)

## The shape of prod frontends

All four prod frontends are DigitalOcean App Platform apps sourced from **GHCR**
(not a git build, despite what an old `infra/do/*.yaml` may say — see Drift note):

| App                  | Image                                           |
| -------------------- | ----------------------------------------------- |
| grove-goldberry-prod | `ghcr.io/goldberry-playground/grove-goldberry`  |
| grove-ggg-prod       | `ghcr.io/goldberry-playground/grove-ggg`        |
| grove-nursery-prod   | `ghcr.io/goldberry-playground/grove-nursery`    |
| grove-hub-prod       | `ghcr.io/goldberry-playground/grove-hub`        |

## Two hard lessons (GOL-1607) — read before touching a prod app

### Lesson 1 — Pinning a tag deploys nothing on a GHCR-sourced app
App Platform's `image.deploy_on_push` is a **DOCR-only** feature. DO accepts it on
a GHCR spec and then silently ignores it. So moving the pinned tag (whether via a
new `:latest` push or `doctl apps update --spec`) changes the *desired* state but
never rolls it out. **You must follow any pin change with an explicit
`doctl apps create-deployment`.** Its absence is what left all four prod frontends
serving a stale build on 2026-08-17 with no error anywhere.

### Lesson 2 — Never fire create-deployment while one is in flight
Two `create-deployment` calls back-to-back on the same app make DO cancel/supersede
the in-progress rollout, and its auto-rollback then restores the **previous (stale)**
build — the exact thing you were replacing. Create **exactly one** deployment per
pin change, and only when no rollout is already running. Do not wrap it in a retry.

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

## Promoting a new build (rides along with GOL-1304 pinning)

The GOL-1304 PR pins each prod app to an immutable image tag (a SHA/version instead
of `:latest`) so prod serves a deliberate, known build rather than auto-advancing on
every merge. The promote flow it wires is:

1. Update the pinned tag in the app spec (`doctl apps update <id> --spec ...`).
2. `source scripts/lib/do-app-redeploy.sh && do_app_redeploy <app>` — one deploy.

Step 2 is the reusable primitive this issue (GOL-1600) provides; GOL-1304 supplies
the pin in step 1. **Do not** add an automatic prod redeploy on every push to main —
that defeats the point of pinning. Promotion is deliberate.

## The alarm — `.github/workflows/prod-deploy-drift.yml`

Runs every 30 min (and on demand). For each prod app it compares the digest the app
is **actually serving** (`active_deployment.services[].source_image_digest`) against
the digest its pinned tag **resolves to on GHCR right now**. Any mismatch — or a
non-`ACTIVE` deployment phase — posts a Discord ops alarm and reds the run. Read-only;
it never deploys. This is the alarm 08-17 lacked. Verified live 2026-08-18: all four
prod apps reported `OK`.

## Drift note — codified spec vs live spec

As of 2026-08-18 `infra/do/*.yaml` still describe **git-sourced** apps, but the live
prod apps are **GHCR-sourced**. The drift monitor above catches *serving-vs-pin* drift;
reconciling the committed specs to the live GHCR model is tracked separately (GOL-1304
pinning + follow-up). Until then, treat GHCR as the source of truth for what prod runs.
