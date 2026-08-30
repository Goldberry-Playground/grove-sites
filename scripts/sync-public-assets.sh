#!/usr/bin/env bash
###############################################################################
# sync-public-assets.sh — keep the shared CDN in lockstep with the repo's
# bundled front-end photos (GOL-1602).
#
# WHY THIS EXISTS
#   Front-end image assets live in the repo under apps/<tenant>/public/photos/**
#   and are ALSO served from the shared CDN (assets.gatheringatthegrove.com ->
#   DO Spaces bucket `grove-assets`). `assetPath(tenant, subpath)` resolves to
#   the CDN in QA/prod (NEXT_PUBLIC_ASSETS_URL set) and falls back to the
#   bundled /public copy in local dev. Git is the single source of truth; the
#   deploy pipeline shipped the bundled copy but never mirrored changed photos
#   to Spaces, so any CDN-referenced image that changed in a PR went stale on
#   the CDN until someone ran a manual upload + purge. This bit us on PR #534
#   (farm-hero.webp + 3 Inoculation-Day slideshow photos). This script closes
#   that gap and is invoked by .github/workflows/cdn-asset-sync.yml on merge.
#
# WHAT IT DOES (idempotent, safe to run twice)
#   For every apps/<tenant>/public/photos/ directory:
#     1. `aws s3 sync --size-only` it to s3://$SPACES_BUCKET/<tenant>/photos/
#        with public-read ACL, immutable cache headers, and an explicit
#        Content-Type per extension. --size-only means unchanged bytes are
#        skipped (git checkout mtimes would otherwise churn every file).
#     2. Collect the object keys that were actually uploaded.
#     3. Purge exactly those keys from Cloudflare (by URL) and the DO Spaces
#        CDN endpoint (by path) so the edge serves the new bytes immediately.
#
#   Mapping:  apps/goldberry/public/photos/farm-hero.webp
#          -> s3://grove-assets/goldberry/photos/farm-hero.webp
#          -> https://assets.gatheringatthegrove.com/goldberry/photos/farm-hero.webp
#
# NO git-diff / push-event dependency: a full `--size-only` sync converges to
# the same state whether it runs on a `push` or a `workflow_dispatch` reconcile,
# so it is immune to the GITHUB_TOKEN push-suppression trap (GOL-768) that makes
# agent-merged commits skip their `push` workflow run.
#
# ENV CONTRACT (all injected from 1Password in CI; see the workflow header):
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   grove-assets RW Spaces key
#   SPACES_BUCKET        default: grove-assets
#   SPACES_REGION        default: nyc3
#   CLOUDFLARE_API_TOKEN CF token with Zone > Cache Purge on the assets zone
#   CLOUDFLARE_ZONE_ID   default: 04ca33af08b2671402393a444da0e698  (gatheringatthegrove.com)
#   DO_API_TOKEN         DO token for the CDN cache purge
#   DO_CDN_ENDPOINT_ID   default: e7c23dab-d41e-4b23-9d23-5c5acfaba596
#   ASSETS_HOST          default: assets.gatheringatthegrove.com
#
# FLAGS
#   --dry-run   plan the syncs + purges, touch no network (no creds needed)
#   --tenant T  restrict to a single tenant (repeatable); default: all found
#
# EXIT CODES
#   0  sync + purge succeeded (or dry-run)
#   1  bad args / missing tooling
#   3  missing Spaces credentials (not a dry-run)
#   4  an s3 sync failed
#   (purge failures are WARNINGS, never fatal — the edge TTL refreshes anyway)
###############################################################################
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUCKET="${SPACES_BUCKET:-grove-assets}"
REGION="${SPACES_REGION:-nyc3}"
ENDPOINT="https://${REGION}.digitaloceanspaces.com"
ASSETS_HOST="${ASSETS_HOST:-assets.gatheringatthegrove.com}"
CF_ZONE_ID="${CLOUDFLARE_ZONE_ID:-04ca33af08b2671402393a444da0e698}"
DO_CDN_ENDPOINT_ID="${DO_CDN_ENDPOINT_ID:-e7c23dab-d41e-4b23-9d23-5c5acfaba596}"

# extension -> Content-Type. One `aws s3 sync` pass per extension so every
# object gets the right MIME type (sync applies one --content-type per call).
EXT_TYPES=(
  "webp:image/webp"
  "png:image/png"
  "jpg:image/jpeg"
  "jpeg:image/jpeg"
  "svg:image/svg+xml"
  "gif:image/gif"
  "avif:image/avif"
)

DRY_RUN=0
TENANT_FILTER=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --tenant)  TENANT_FILTER+=("$2"); shift 2 ;;
    -h|--help) sed -n '2,60p' "$0"; exit 0 ;;
    *) echo "::error::unknown arg: $1" >&2; exit 1 ;;
  esac
done

log() { echo "  $*"; }

if [ "$DRY_RUN" = "0" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "::error::aws CLI not installed. Install awscli (present on ubuntu-latest)." >&2
    exit 1
  fi
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    echo "::error::AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set (grove-assets RW Spaces key)." >&2
    exit 3
  fi
fi

# Discover apps/<tenant>/public/photos/ dirs.
declare -a TENANTS=()
for d in "$REPO_ROOT"/apps/*/public/photos; do
  [ -d "$d" ] || continue
  tenant="$(basename "$(dirname "$(dirname "$d")")")"
  if [ "${#TENANT_FILTER[@]}" -gt 0 ]; then
    keep=0
    for t in "${TENANT_FILTER[@]}"; do [ "$t" = "$tenant" ] && keep=1; done
    [ "$keep" = "1" ] || continue
  fi
  TENANTS+=("$tenant")
done

if [ "${#TENANTS[@]}" -eq 0 ]; then
  log "No apps/*/public/photos/ directories matched; nothing to sync."
  exit 0
fi

log "Bucket:  s3://${BUCKET} (${REGION}, ${ENDPOINT})"
log "Tenants: ${TENANTS[*]}"
[ "$DRY_RUN" = "1" ] && log "(dry-run — no network calls)"

# Accumulates the object keys uploaded this run (for targeted cache purge).
UPLOADED_KEYS=()

for tenant in "${TENANTS[@]}"; do
  local_dir="$REPO_ROOT/apps/$tenant/public/photos"
  prefix="$tenant/photos"
  log ""
  log "== $tenant :: $local_dir/  ->  s3://$BUCKET/$prefix/"

  for pair in "${EXT_TYPES[@]}"; do
    ext="${pair%%:*}"
    ctype="${pair#*:}"

    # Skip the pass entirely if this tenant has no files of this extension.
    if ! find "$local_dir" -type f -iname "*.$ext" -print -quit | grep -q .; then
      continue
    fi

    if [ "$DRY_RUN" = "1" ]; then
      # Show what a real sync would consider (every candidate file); the real
      # run only re-uploads size-changed ones.
      while IFS= read -r f; do
        rel="${f#"$local_dir"/}"
        log "  [plan:$ctype] $prefix/$rel"
      done < <(find "$local_dir" -type f -iname "*.$ext" | sort)
      continue
    fi

    # Real sync. --size-only: re-upload only when the byte size differs, so
    # git-checkout mtimes don't force a full re-upload every run.
    out="$(aws s3 sync "$local_dir/" "s3://$BUCKET/$prefix/" \
      --endpoint-url "$ENDPOINT" \
      --acl public-read \
      --size-only --no-progress \
      --exclude "*" --include "*.$ext" \
      --content-type "$ctype" \
      --cache-control "public, max-age=31536000, immutable" 2>&1)" || {
      echo "$out" >&2
      echo "::error::aws s3 sync failed for $tenant (*.$ext)" >&2
      exit 4
    }
    [ -n "$out" ] && echo "$out"

    # Parse "upload: <local> to s3://<bucket>/<key>" -> collect <key>.
    while IFS= read -r line; do
      case "$line" in
        upload:*"to s3://$BUCKET/"*)
          key="${line##*to s3://$BUCKET/}"
          UPLOADED_KEYS+=("$key")
          log "  [uploaded] $key"
          ;;
      esac
    done <<< "$out"
  done
done

if [ "$DRY_RUN" = "1" ]; then
  log ""
  log "dry-run complete — no uploads, no purges."
  exit 0
fi

if [ "${#UPLOADED_KEYS[@]}" -eq 0 ]; then
  log ""
  log "CDN already in sync — nothing changed, no purge needed."
  exit 0
fi

log ""
log "Uploaded ${#UPLOADED_KEYS[@]} object(s). Purging edge caches…"

# ── Cloudflare purge (by absolute URL, max 30 per request) ──────────────────
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  urls=()
  for k in "${UPLOADED_KEYS[@]}"; do urls+=("https://${ASSETS_HOST}/${k}"); done
  # chunk into batches of 30
  i=0
  total="${#urls[@]}"
  cf_ok=1
  while [ "$i" -lt "$total" ]; do
    batch=("${urls[@]:i:30}")
    body="$(printf '%s\n' "${batch[@]}" | python3 -c 'import json,sys; print(json.dumps({"files":[l.strip() for l in sys.stdin if l.strip()]}))')"
    if curl -sf -X POST \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data "$body" \
        "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" >/dev/null 2>&1; then
      :
    else
      cf_ok=0
    fi
    i=$((i + 30))
  done
  if [ "$cf_ok" = "1" ]; then log "  [ok] Cloudflare purged (${total} url(s))"; else
    echo "::warning::Cloudflare purge failed for one or more batches. Upload succeeded; edge TTL will refresh naturally." >&2
  fi
else
  echo "::warning::CLOUDFLARE_API_TOKEN unset — skipped Cloudflare purge (edge TTL will refresh naturally)." >&2
fi

# ── DigitalOcean Spaces CDN purge (by path, single request) ─────────────────
if [ -n "${DO_API_TOKEN:-}" ] && [ -n "$DO_CDN_ENDPOINT_ID" ]; then
  do_body="$(printf '%s\n' "${UPLOADED_KEYS[@]}" | python3 -c 'import json,sys; print(json.dumps({"files":[l.strip() for l in sys.stdin if l.strip()]}))')"
  if curl -sf -X DELETE \
      -H "Authorization: Bearer ${DO_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$do_body" \
      "https://api.digitalocean.com/v2/cdn/endpoints/${DO_CDN_ENDPOINT_ID}/cache" >/dev/null 2>&1; then
    log "  [ok] DO CDN purged (${#UPLOADED_KEYS[@]} path(s))"
  else
    echo "::warning::DO CDN purge failed. Upload succeeded; edge TTL will refresh naturally." >&2
  fi
else
  echo "::warning::DO_API_TOKEN / DO_CDN_ENDPOINT_ID unset — skipped DO CDN purge (edge TTL will refresh naturally)." >&2
fi

log ""
log "Done. Live URLs:"
for k in "${UPLOADED_KEYS[@]}"; do log "  https://${ASSETS_HOST}/${k}"; done
