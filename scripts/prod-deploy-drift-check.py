#!/usr/bin/env python3
"""
prod-deploy-drift-check.py — fail loudly when a prod frontend is serving a build
that is NOT the one its pinned tag currently points to.

WHY THIS EXISTS
---------------
On 2026-08-17 all four grove-*-prod apps served a stale build for hours. Root
cause (GOL-1607): they source their image from GHCR, App Platform's
`deploy_on_push` is silently ignored for external registries, so a new image on
the tag never rolled out. The incident was found BY HAND. It should have
alarmed. This is that alarm.

WHAT "DRIFT" MEANS HERE
-----------------------
For each app we compare two facts, both read-only:

  serving_digest  = active_deployment.services[].source_image_digest
                    (the exact manifest DO actually rolled out)
  intended_digest = the digest that <registry>/<repo>:<tag> resolves to on GHCR
                    right now (the manifest the pin currently points at)

If serving_digest != intended_digest, the app's pinned tag has moved to a build
that was never deployed -> DRIFT -> exit non-zero + a machine-readable report the
workflow turns into a Discord alarm. This is tag-value agnostic: it catches the
`:latest`-moved case we hit on 08-17 AND the post-GOL-1304 SHA-pinned case where
someone bumps the pin without an explicit create-deployment.

A non-ACTIVE deployment phase (ERROR / stuck build) is also reported as drift —
a prod app that failed its last rollout is exactly as broken as a stale one.

WHY A MISMATCH IS NOT ALWAYS DRIFT (GOL-3135)
---------------------------------------------
`serving != intended` is ALSO the exact state of the world during a perfectly
healthy rollout: the tag has already moved (so `intended` advanced) while
`active_deployment` is still the OLD deployment, phase ACTIVE, serving the old
digest. The new one lives in `in_progress_deployment` until it finishes.

The original check read only `active_deployment`, so it called that DRIFT and
fired a Discord ops alarm — i.e. it alarmed on every deploy it happened to catch
mid-flight. That stayed rare only because GitHub throttles `schedule` to ~5
firings/day (GOL-3132), which is also why this workflow cannot be given an event
heartbeat until the mismatch is disambiguated. So we now read the in-flight
deployment too and split the mismatch three ways:

  ROLLING_OUT        a deployment is in flight, in a genuinely in-flight phase,
                     heading for `intended`, and younger than the grace window
                     -> informational, exit 0. Prod is mid-deploy, not drifted.
  ROLLING_OUT_STALE  same, but it has been in flight longer than the grace
                     window -> DRIFT. A rollout wedged in BUILDING/DEPLOYING is
                     GOL-1607 wearing a disguise and must stay loud.
  DRIFT              no deployment in flight at all (the pin moved and nothing
                     is rolling it out), or one is in flight toward a DIFFERENT
                     digest than the pin now names.

Every branch that is not this mismatch — UNHEALTHY / UNKNOWN / OK / GHCR_ERROR /
MISSING / SKIPPED — is deliberately unchanged. In particular UNHEALTHY is still
evaluated FIRST: an app whose active deployment is broken is broken even if a
replacement is already building.

THE GRACE WINDOW IS A BACKSTOP, NOT THE PRIMARY SIGNAL
------------------------------------------------------
Classification leans on the deployment PHASE first (the same four phases
scripts/lib/do-app-redeploy.sh treats as "a rollout is still happening", kept
in sync deliberately — that file is the SSOT for this list). A rollout that
errors or is superseded leaves those phases immediately and is no longer
"in flight", so the age bound only ever has to catch a rollout genuinely WEDGED
in an in-flight phase.

ROLLOUT_GRACE_MINUTES defaults to 20. That default is derived, NOT measured:
`Docker — Frontends` builds measured 2.0-4.9 min wall-clock over 15 runs
(2026-10-05/06), and this repo already treats 20 min as the outer bound for a
deploy job (`timeout-minutes: 20` on release.yml's deploy-sandbox and
deploy-production). The monitoring credential was not readable from the agent
container, so the App Platform rollout leg itself could not be timed directly.
To make the number self-correcting, every in-flight classification reports
`rollout_age_minutes`; after a few weeks of runs the real distribution is in the
artifacts and the default can be tightened with evidence instead of convention.
Override with ROLLOUT_GRACE_MINUTES=<n> without touching code.

INPUTS (env)
------------
  DIGITALOCEAN_TOKEN   DO API token (read-only is enough; we only GET)
  GHCR_TOKEN           a GitHub token with read:packages for the org's images
                       (GITHUB_TOKEN works when the workflow grants packages:read)
  APP_NAMES            optional, space-separated; defaults to the 4 prod apps
  DRIFT_REPORT_FILE    optional; if set, a JSON report is written there for the
                       caller (the workflow) to build the Discord payload
  ROLLOUT_GRACE_MINUTES
                       optional; how long an in-flight rollout may run before it
                       is treated as wedged (drift). Default 20.

EXIT
----
  0  every targeted app is serving exactly its pinned build, or is partway
     through a healthy rollout onto it
  1  at least one app is drifted / unhealthy / wedged mid-rollout (or a hard
     error occurred)
"""
import base64
import datetime
import json
import os
import sys
import urllib.request
import urllib.error

DEFAULT_APPS = [
    "grove-goldberry-prod",
    "grove-ggg-prod",
    "grove-nursery-prod",
    "grove-hub-prod",
]

DO_API = "https://api.digitalocean.com/v2/apps?per_page=200"
DO_DEPLOYMENTS = "https://api.digitalocean.com/v2/apps/{app_id}/deployments?per_page=20"

# Deployment phases that mean "a rollout is still happening". Anything else
# (ACTIVE, SUPERSEDED, ERROR, CANCELED) is terminal, so a deployment sitting in
# one of those is NOT in flight and cannot excuse a digest mismatch.
#
# Kept deliberately identical to _DO_INFLIGHT_PHASES in
# scripts/lib/do-app-redeploy.sh, which is the SSOT for this list: that file's
# "Lesson 2" guard refuses to create a second deployment while one of these
# phases is current. If the two ever disagree, this checker would alarm on a
# rollout the redeploy helper is deliberately waiting out. Change both together.
INFLIGHT_PHASES = frozenset({
    "PENDING_BUILD",
    "BUILDING",
    "PENDING_DEPLOY",
    "DEPLOYING",
})

# How long a rollout may stay in an in-flight phase before we call it wedged.
# See "THE GRACE WINDOW IS A BACKSTOP" in the module docstring for where 20
# comes from and why it is an env knob.
DEFAULT_ROLLOUT_GRACE_MINUTES = 20.0
GHCR = "https://ghcr.io/v2/{owner}/{repo}/manifests/{ref}"
# Ask for every manifest media type so multi-arch indexes and single manifests
# both return their canonical Docker-Content-Digest.
MANIFEST_ACCEPT = ", ".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])


def _get(url, headers, want_header=None):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        if want_header:
            return resp.headers.get(want_header)
        return json.loads(resp.read().decode())


def ghcr_digest(owner, repo, ref, bearer_b64):
    """Return the manifest digest GHCR currently serves for owner/repo:ref."""
    url = GHCR.format(owner=owner, repo=repo, ref=ref)
    headers = {"Authorization": f"Bearer {bearer_b64}", "Accept": MANIFEST_ACCEPT}
    return _get(url, headers, want_header="Docker-Content-Digest")


def _parse_ts(value):
    """Parse a DO API RFC-3339 timestamp into an aware datetime, or None."""
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def deployment_digest(dep):
    """The image digest a deployment is rolling out, or None if not resolved yet.

    Early in a rollout (PENDING_BUILD / BUILDING) App Platform has not recorded
    a source_image_digest yet, so None is normal and must NOT be read as "wrong
    digest" — that is the false alarm this whole change exists to remove.
    """
    for svc in (dep or {}).get("services") or []:
        if svc.get("source_image_digest"):
            return svc["source_image_digest"]
    return None


def find_inflight_deployment(app, list_deployments=None):
    """Return the deployment currently rolling out for `app`, else None.

    Primary source is `app.in_progress_deployment`, which App Platform
    populates only while a rollout is actually happening.

    Fallback: if that key is ABSENT (not merely empty) we ask the deployments
    endpoint for the newest deployment and check its phase — the same move
    do-app-redeploy.sh makes. This matters because the whole fix would
    otherwise fail silently, and silently, to no effect, if the /v2/apps list
    payload ever omits the field: we would be back to alarming on every
    mid-rollout poll with nothing in the report to say why.
    """
    if "in_progress_deployment" in app:
        ip = app.get("in_progress_deployment") or {}
        if not ip:
            return None
        # Present but already terminal -> the rollout is over, not in flight.
        phase = ip.get("phase")
        if phase is not None and phase not in INFLIGHT_PHASES:
            return None
        return ip

    if list_deployments is None:
        return None
    try:
        deps = list_deployments(app["id"]) or []
    except Exception:  # noqa: BLE001 - a failed probe must not mask the drift
        return None
    newest = None
    for dep in deps:
        if newest is None or (dep.get("created_at") or "") > (newest.get("created_at") or ""):
            newest = dep
    if newest and newest.get("phase") in INFLIGHT_PHASES:
        return newest
    return None


def classify_mismatch(app, intended, now, grace_minutes, list_deployments=None):
    """Decide what a `serving != intended` mismatch actually means.

    Returns (status, detail, extra_fields, is_drift).
    """
    inflight = find_inflight_deployment(app, list_deployments=list_deployments)

    if inflight is None:
        # Nothing is rolling out, so the pin genuinely moved with no deploy
        # behind it. This is the original GOL-1600 alarm, unchanged.
        return ("DRIFT", None, {}, True)

    started = _parse_ts(inflight.get("created_at"))
    if started is None:
        # A rollout is in flight but we cannot age it, so we cannot tell
        # "deploying" from "wedged". DO always returns created_at, so this is an
        # API-shape surprise rather than a routine state; a monitor facing an
        # unknown stays loud. (If this ever fires routinely, that is the bug.)
        return ("DRIFT",
                f"a deployment is in flight (phase {inflight.get('phase')}) but has "
                f"no parseable created_at, so its age cannot be bounded — treating "
                f"as drift rather than assuming it is healthy",
                {"rollout_phase": inflight.get("phase")},
                True)

    age = (now - started).total_seconds() / 60.0
    target = deployment_digest(inflight)
    extra = {
        "rollout_phase": inflight.get("phase"),
        "rollout_age_minutes": round(age, 1),
        "rollout_target": target,
    }

    if target is not None and target != intended:
        # Something IS rolling out, but not the thing the pin now names.
        return ("DRIFT",
                f"a deployment is in flight (phase {inflight.get('phase')}, "
                f"{age:.1f} min) but it targets {target[:19]}…, not the pinned "
                f"{intended[:19]}… — the pin moved after this rollout started",
                extra, True)

    toward = (f"onto {target[:19]}…" if target
              else "target digest not resolved yet (normal this early)")

    if age > grace_minutes:
        return ("ROLLING_OUT_STALE",
                f"deployment has been in phase {inflight.get('phase')} for "
                f"{age:.1f} min (> {grace_minutes:g} min grace) — a rollout this "
                f"stuck is the GOL-1607 failure mode; prod is still serving the "
                f"old build",
                extra, True)

    return ("ROLLING_OUT",
            f"rollout in flight {toward}, phase {inflight.get('phase')}, "
            f"{age:.1f} min old (< {grace_minutes:g} min grace) — prod is "
            f"mid-deploy, not drifted",
            extra, False)


def main():
    do_token = os.environ.get("DIGITALOCEAN_TOKEN", "").strip()
    ghcr_token = os.environ.get("GHCR_TOKEN", "").strip()
    if not do_token:
        print("::error::DIGITALOCEAN_TOKEN is empty — cannot query App Platform.")
        return 1
    if not ghcr_token:
        print("::error::GHCR_TOKEN is empty — cannot resolve GHCR digests.")
        return 1

    app_names = os.environ.get("APP_NAMES", "").split() or DEFAULT_APPS
    # GHCR accepts a GitHub token base64-encoded as the bearer.
    bearer_b64 = base64.b64encode(ghcr_token.encode()).decode()

    raw_grace = os.environ.get("ROLLOUT_GRACE_MINUTES", "").strip()
    try:
        grace_minutes = float(raw_grace) if raw_grace else DEFAULT_ROLLOUT_GRACE_MINUTES
    except ValueError:
        print(f"::warning::ROLLOUT_GRACE_MINUTES={raw_grace!r} is not a number — "
              f"using the {DEFAULT_ROLLOUT_GRACE_MINUTES:g} min default.")
        grace_minutes = DEFAULT_ROLLOUT_GRACE_MINUTES

    def list_deployments(app_id):
        """Only called when in_progress_deployment is missing from the payload."""
        return _get(DO_DEPLOYMENTS.format(app_id=app_id),
                    {"Authorization": f"Bearer {do_token}"}).get("deployments")

    try:
        apps = _get(DO_API, {"Authorization": f"Bearer {do_token}"})["apps"]
    except (urllib.error.URLError, KeyError) as exc:
        print(f"::error::Failed to list DigitalOcean apps: {exc}")
        return 1

    by_name = {a["spec"]["name"]: a for a in apps}
    results = []
    drift = False
    # One timestamp for the whole sweep: four apps judged against four slightly
    # different "now"s is a needless source of flaky edge cases at the boundary.
    now = datetime.datetime.now(datetime.timezone.utc)

    for name in app_names:
        app = by_name.get(name)
        if app is None:
            drift = True
            results.append({"app": name, "status": "MISSING",
                            "detail": "no DigitalOcean app with this name"})
            print(f"::error::{name}: no such DigitalOcean app")
            continue

        svc = app["spec"]["services"][0]
        img = svc.get("image") or {}
        if (img.get("registry_type") or "").upper() != "GHCR":
            # Not GHCR-sourced -> this checker's digest comparison does not apply.
            results.append({"app": name, "status": "SKIPPED",
                            "detail": f"registry_type={img.get('registry_type')}"})
            print(f"{name}: SKIPPED (not GHCR-sourced)")
            continue

        owner = img["registry"]
        repo = img["repository"]
        tag = img.get("tag", "latest")

        ad = app.get("active_deployment") or {}
        phase = ad.get("phase")
        serving = None
        for s in ad.get("services", []):
            if s.get("source_image_digest"):
                serving = s["source_image_digest"]
                break

        try:
            intended = ghcr_digest(owner, repo, tag, bearer_b64)
        except (urllib.error.URLError, urllib.error.HTTPError) as exc:
            drift = True
            results.append({"app": name, "status": "GHCR_ERROR", "tag": tag,
                            "detail": str(exc)})
            print(f"::error::{name}: could not resolve GHCR {owner}/{repo}:{tag} ({exc})")
            continue

        entry = {"app": name, "tag": f"{owner}/{repo}:{tag}", "phase": phase,
                 "serving": serving, "intended": intended}

        if phase != "ACTIVE":
            drift = True
            entry["status"] = "UNHEALTHY"
            entry["detail"] = f"active_deployment phase is {phase}, not ACTIVE"
            print(f"::error::{name}: deployment phase {phase} (not ACTIVE)")
        elif serving is None:
            drift = True
            entry["status"] = "UNKNOWN"
            entry["detail"] = "no source_image_digest on active deployment"
            print(f"::error::{name}: active deployment has no source_image_digest")
        elif serving != intended:
            # A mismatch is drift ONLY if nothing healthy is rolling out onto
            # the new pin right now (GOL-3135).
            status, detail, extra, is_drift = classify_mismatch(
                app, intended, now, grace_minutes,
                list_deployments=list_deployments)
            entry.update(extra)
            entry["status"] = status
            entry["detail"] = detail or (
                f"serving {serving[:19]}… but tag now points at "
                f"{intended[:19]}… — pin moved without a deploy")
            if is_drift:
                drift = True
                print(f"::error::{name}: {status} — serving {serving} != pin "
                      f"{intended} ({entry['detail']})")
            else:
                # Informational: a run must not go red for a healthy deploy.
                print(f"{name}: {status} — {entry['detail']}")
        else:
            entry["status"] = "OK"
            print(f"{name}: OK — serving pinned build {serving[:19]}…")

        results.append(entry)

    report = {"drift": drift, "rollout_grace_minutes": grace_minutes,
              "apps": results}
    report_file = os.environ.get("DRIFT_REPORT_FILE", "").strip()
    if report_file:
        with open(report_file, "w") as fh:
            json.dump(report, fh, indent=2)

    print("\n=== prod deploy drift report ===")
    print(json.dumps(report, indent=2))
    return 1 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
