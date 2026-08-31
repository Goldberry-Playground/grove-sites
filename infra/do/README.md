# DigitalOcean App Platform — frontend deploys

Four App Platform spec files, one per business. Each spec wires GitHub →
Dockerfile build → DO App Platform with auto-redeploy on push to `main`.

| Spec | App name | Domain | Source Dockerfile |
|------|----------|--------|-------------------|
| `hub.yaml` | `grove-hub` | gatheringatthegrove.com | `apps/hub/Dockerfile` |
| `goldberry.yaml` | `grove-goldberry` | goldberrygrove.farm | `apps/goldberry/Dockerfile` |
| `ggg.yaml` | `grove-ggg` | woodworkingeorge.com | `apps/ggg/Dockerfile` |
| `nursery.yaml` | `grove-nursery` | atthegrovenursery.com | `apps/nursery/Dockerfile` |

## Prerequisites

1. Install the DO CLI: `brew install doctl`
2. Authenticate once: `doctl auth init` (paste a DO API token)
3. Authorize the GitHub repo in DO: open the DO Console once, go to
   **Apps → Create App → GitHub**, and grant access to
   `Goldberry-Playground/grove-sites`. App Platform won't watch the repo
   without this one-time OAuth approval.

## First-time create

```bash
# Validate every spec before touching DO.
for spec in infra/do/*.yaml; do
  echo "── validating $spec"
  doctl apps spec validate "$spec"
done

# Create one app at a time so you can fix issues in isolation.
doctl apps create --spec infra/do/hub.yaml
doctl apps create --spec infra/do/goldberry.yaml
doctl apps create --spec infra/do/ggg.yaml
doctl apps create --spec infra/do/nursery.yaml
```

Each `create` prints an `APP_ID` — record them; you'll need them for updates.

## Updates after first create

Once the apps exist, edits to the spec files are applied with `update`:

```bash
doctl apps update <APP_ID> --spec infra/do/hub.yaml
```

> ⚠️ **Secret-clobber hazard.** Applying a spec **file** verbatim overwrites
> *every* env var, so the `REPLACE_ME` placeholders reset the app's live
> secrets (`ODOO_API_KEY`, `GHOST_CONTENT_KEY`, RUM token, …) to `REPLACE_ME`
> and break the running app. Only apply a file verbatim on **first create**.
> To change a **non-secret** env var (e.g. `GHOST_NEWSLETTER_INSTANCES`) on a
> live app, use one of these instead:
>
> - **DO Console (simplest, zero-risk):** App → Settings → the service →
>   Environment Variables → add/edit the single key → Save. Nothing else is
>   touched.
> - **CLI, secret-safe merge:** pull the *live* spec (its secrets come back as
>   encrypted `EV[…]` values that round-trip untouched), inject just the one
>   key from the committed file, and push it back:
>
>   ```bash
>   APP_ID=$(doctl apps list --format ID,Spec.Name --no-header \
>     | awk '$2=="grove-nursery"{print $1}')
>   NEW=$(yq -r '.services[0].envs[] | select(.key=="GHOST_NEWSLETTER_INSTANCES") | .value' \
>     infra/do/nursery.yaml)
>   doctl apps spec get "$APP_ID" \
>     | yq '.services[0].envs += [{"key":"GHOST_NEWSLETTER_INSTANCES","scope":"RUN_AND_BUILD_TIME","value":env(NEW)}]' \
>     | doctl apps update "$APP_ID" --spec -
>   ```
>   (If the key already exists, replace the `+=` append with a `map(...)`
>   update as in *Setting secrets* below.)

For routine code changes, you do **not** need `doctl update` — every push
to `main` that touches the relevant app paths triggers an auto-redeploy
(see `deploy_on_push: true` in each spec).

## Setting secrets

All specs ship with `REPLACE_ME` placeholders for secret env vars
(`ODOO_API_KEY`, `GHOST_CONTENT_KEY`, `GROVE_REVALIDATE_SECRET`,
`HUB_GHOST_CONTENT_API_KEY`). Set real values either in the DO Console
(**App → Settings → service → Environment Variables**) or via CLI:

```bash
doctl apps update <APP_ID> --spec - <<EOF
$(yq '.services[0].envs |= map(
  if .key == "ODOO_API_KEY" then .value = "real-key-here" else . end
)' infra/do/goldberry.yaml)
EOF
```

In practice the Console is faster for one-offs; reach for the CLI when you
need to rotate secrets across all four apps at once.

## Domains & DNS

Each spec declares two domains: the apex (`example.com`, `type: PRIMARY`)
and `www.` (`type: ALIAS`). For App Platform to terminate TLS for these
domains you need to point the DNS at the App Platform endpoint:

1. After `doctl apps create`, copy the ingress hostname from `doctl apps get`.
2. At your registrar / DNS host, set a CNAME from each domain to the ingress
   hostname (or use DO-managed DNS, in which case the spec's `zone:` entries
   are enough — DO will provision the records).

DO issues Let's Encrypt certs automatically once DNS is resolving.

## Local validation

```bash
# Lint the spec files locally (no DO API call).
doctl apps spec validate infra/do/hub.yaml
```

A GitHub Actions workflow at `.github/workflows/do-spec-validate.yml`
(if/when added) runs the same check on every PR that touches `infra/do/`.

## Why one App per site (not one App with four services)?

- Each business owns its own domain, billing line, and rollout cadence.
- Goldberry can scale up for a Black Friday sale without affecting the hub.
- A bad deploy on one site doesn't pause the others.

Trade-off: four base $5/mo App Platform charges instead of one. Worth it
for the failure isolation given the village model — each maker's till is
their own.

## Troubleshooting

**Deploy fails at "build" stage** — check the build logs in the DO
Console. The most common cause is `pnpm install --frozen-lockfile`
disagreeing with the lockfile (a dep was added without committing
`pnpm-lock.yaml`).

**Deploy succeeds but health check fails** — the container is listening
on a different port than `http_port`. Verify the Dockerfile's
`ENV PORT=...` matches the spec's `http_port:`.

**Page renders but featured products are empty** — backend not reachable
from App Platform. Check that `GROVE_ODOO_URL` / `ODOO_URL` points at a
public hostname (not `localhost` or `host.docker.internal`).
