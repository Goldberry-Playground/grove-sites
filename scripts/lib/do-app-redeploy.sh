#!/usr/bin/env bash
#
# do-app-redeploy.sh — the ONE codified way to roll a DigitalOcean App Platform
# app forward onto a freshly-pinned image. Sourceable as a library or runnable
# as a CLI:
#
#     do_app_redeploy grove-goldberry-prod          # from another script
#     scripts/lib/do-app-redeploy.sh grove-ggg-prod # standalone
#
# It exists because the two hard lessons from the 2026-08-17 prod-stale incident
# (GOL-1607) are not obvious and cost a hand-diagnosed outage. This file is where
# they live so nobody has to relearn them:
#
#   LESSON 1 — Pinning a tag deploys NOTHING on a GHCR-sourced app.
#     All grove-*-prod (and -qa) apps source their image from GHCR
#     (registry_type: GHCR). App Platform's `image.deploy_on_push` field is a
#     DOCR-only feature: DO accepts it on an external-registry spec and then
#     silently ignores it. So `doctl apps update --spec` (which moves the pinned
#     tag) changes the DESIRED state but never rolls it out. You MUST follow the
#     spec update with an explicit `doctl apps create-deployment`. This is the
#     step whose absence left all four prod frontends serving a stale build on
#     2026-08-17 with no error anywhere.
#
#   LESSON 2 — Never fire create-deployment while one is already in flight.
#     Two create-deployment calls back-to-back on the same app make DO cancel /
#     supersede the in-progress rollout, and its auto-rollback then restores the
#     PREVIOUS (stale) build — the exact thing you were trying to replace. So
#     this function refuses to create a second deployment when the latest one is
#     still building/deploying, and it creates EXACTLY ONE deployment per call
#     with no retry loop. Callers must not wrap it in a retry.
#
# Requires: doctl (authenticated via DIGITALOCEAN_ACCESS_TOKEN in the env — the
# digitalocean/action-doctl step exports it), jq.
#
# Exit / return codes:
#   0  a new deployment was created and reached ACTIVE
#   2  skipped on purpose — a deployment was already in flight (Lesson 2 guard)
#   1  hard failure — app not found, rollout errored, or a tool blew up
#
set -euo pipefail

# DO deployment phases that mean "a rollout is still happening". Anything else
# (ACTIVE, SUPERSEDED, ERROR, CANCELED) is terminal and safe to deploy over.
_DO_INFLIGHT_PHASES="PENDING_BUILD BUILDING PENDING_DEPLOY DEPLOYING"

_do_is_inflight() {
  local phase="$1"
  case " $_DO_INFLIGHT_PHASES " in
    *" $phase "*) return 0 ;;
    *) return 1 ;;
  esac
}

do_app_redeploy() {
  local app_name="$1"

  if [[ -z "${app_name:-}" ]]; then
    echo "::error::do_app_redeploy: app name is required" >&2
    return 1
  fi

  # Resolve by NAME, never a hardcoded ID: an ID pinned in code rots silently if
  # an app is ever recreated (same reasoning as docker.yml's QA redeploy).
  local app_id
  app_id="$(doctl apps list -o json | jq -r --arg n "$app_name" \
    '.[] | select(.spec.name == $n) | .id' | head -n1)"

  if [[ -z "$app_id" || "$app_id" == "null" ]]; then
    echo "::error::No DigitalOcean app named '${app_name}' — cannot redeploy. It will keep serving its current build until this is fixed." >&2
    return 1
  fi

  # LESSON 2 guard: inspect the most recent deployment before touching anything.
  # doctl lists newest-first; take the first row's phase.
  local latest_phase
  latest_phase="$(doctl apps list-deployments "$app_id" -o json \
    | jq -r 'sort_by(.created_at) | reverse | .[0].phase // "NONE"')"

  if _do_is_inflight "$latest_phase"; then
    echo "::warning title=Redeploy skipped::${app_name} (${app_id}) already has a deployment in phase ${latest_phase}. Firing a second create-deployment now would make DO auto-rollback to the stale build (GOL-1607, Lesson 2). Let this rollout finish, then re-run." >&2
    return 2
  fi

  echo "Creating exactly one deployment for ${app_name} (${app_id}); latest prior phase was ${latest_phase}."
  # --wait turns a failed rollout into a non-zero exit (so the caller/job goes
  # red) instead of failing silently — the whole point of GOL-397 / GOL-1607.
  # No retry loop wraps this: one call, one deployment (Lesson 2).
  doctl apps create-deployment "$app_id" --force-rebuild --wait

  # Emit what actually went live as the audit trail. awk NR==1 (not `head -1`)
  # so a closed pipe can't SIGPIPE doctl and trip pipefail after a good deploy.
  echo "Now serving:"
  doctl apps get-deployment "$app_id" \
    "$(doctl apps list-deployments "$app_id" -o json | jq -r 'sort_by(.created_at) | reverse | .[0].id')" \
    -o json | jq -r '.services[]? | "  \(.name): \(.source_image_digest // "n/a")"'
}

# When executed directly (not sourced), run against the app named on the CLI.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [[ $# -ne 1 ]]; then
    echo "usage: $0 <do-app-name>" >&2
    exit 1
  fi
  do_app_redeploy "$1"
fi
