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

PROD PROBLEM vs MONITOR PROBLEM (GOL-3138)
------------------------------------------
"The checker could not do its job" is NOT "prod is drifted", and conflating the
two is how 14 consecutive runs (2026-10-03 -> 2026-10-05) posted a
"prod frontend drift" alarm to Discord ops while prod was in fact serving
exactly its pinned build. The real condition was a dead DigitalOcean token
(`HTTP Error 401: Unauthorized`), and because the old code returned before
writing the report, the failed runs produced no `drift-report.json` artifact at
all, so nothing downstream could tell the two apart.

So: every failure path now WRITES THE REPORT before returning, and the report
carries `monitor_ok`. A checker-side failure sets `monitor_ok: false` and
`drift: false`; a genuine prod problem sets `drift: true`. The alarm layer
(scripts/prod-drift-alarm.py) words the Discord message off those two flags —
"prod is drifted" vs "the drift check is blind". Both still fail the run. That
script owns the MONITOR-vs-PROD status taxonomy (MONITOR_STATUSES); the statuses
this file emits are inputs to it.

INPUTS (env)
------------
  DIGITALOCEAN_TOKEN   DO API token (read-only is enough; we only GET)
  GHCR_TOKEN           a GitHub token with read:packages for the org's images
                       (GITHUB_TOKEN works when the workflow grants packages:read)
  APP_NAMES            optional, space-separated; defaults to the 4 prod apps
  DRIFT_REPORT_FILE    optional; if set, a JSON report is written there for the
                       caller (the workflow) to build the Discord payload

EXIT
----
  0  every targeted app is serving exactly its pinned build
  1  at least one app is drifted / unhealthy, OR the check could not run
     (distinguish the two via `drift` / `monitor_ok` in the report)
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
GHCR = "https://ghcr.io/v2/{owner}/{repo}/manifests/{ref}"
# Ask for every manifest media type so multi-arch indexes and single manifests
# both return their canonical Docker-Content-Digest.
MANIFEST_ACCEPT = ", ".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])


def write_report(report):
    """Persist the report if DRIFT_REPORT_FILE is set, and echo it to the log.

    Called on EVERY exit path, including the hard-error ones. The artifact being
    absent on a failed run is what made GOL-3138 undiagnosable from the API.
    """
    report.setdefault(
        "generated_at",
        datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    report_file = os.environ.get("DRIFT_REPORT_FILE", "").strip()
    if report_file:
        with open(report_file, "w") as fh:
            json.dump(report, fh, indent=2)
    print("\n=== prod deploy drift report ===")
    print(json.dumps(report, indent=2))
    return report


def monitor_failure(detail, app_names=()):
    """A checker-side failure: prod status is UNKNOWN, not bad. Red run, no drift."""
    print(f"::error::Drift check could not run: {detail}")
    write_report({
        "drift": False,
        "monitor_ok": False,
        "monitor_error": detail,
        # One row per targeted app so the alarm reads "these four are unwatched",
        # not "one global thing broke" — the operator cares about the coverage gap.
        "apps": [{"app": name, "status": "MONITOR_ERROR", "detail": detail}
                 for name in app_names],
    })
    return 1


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


def main():
    do_token = os.environ.get("DIGITALOCEAN_TOKEN", "").strip()
    ghcr_token = os.environ.get("GHCR_TOKEN", "").strip()
    app_names = os.environ.get("APP_NAMES", "").split() or DEFAULT_APPS

    if not do_token:
        return monitor_failure(
            "DIGITALOCEAN_TOKEN is empty — cannot query App Platform.", app_names)
    if not ghcr_token:
        return monitor_failure(
            "GHCR_TOKEN is empty — cannot resolve GHCR digests.", app_names)
    # GHCR accepts a GitHub token base64-encoded as the bearer.
    bearer_b64 = base64.b64encode(ghcr_token.encode()).decode()

    try:
        apps = _get(DO_API, {"Authorization": f"Bearer {do_token}"})["apps"]
    # URLError/HTTPError are OSError subclasses; bare OSError additionally catches
    # the socket TIMEOUT that urlopen raises, which the old tuple let escape as an
    # uncaught traceback. ValueError covers a non-JSON body, KeyError a missing
    # "apps" key. Nothing here may crash the run without writing a report.
    except (urllib.error.URLError, OSError, ValueError, KeyError) as exc:
        # The GOL-3138 streak lived here: a rotated/expired DO token 401s and the
        # old code returned 1 with no report, which the workflow then dressed up
        # as a prod drift alarm. A dead monitoring credential is an OPS problem
        # — same fail-loud-but-honest treatment as OP_CI_SA_TOKEN upstream.
        return monitor_failure(f"Failed to list DigitalOcean apps: {exc}", app_names)

    by_name = {a["spec"]["name"]: a for a in apps}
    results = []
    drift = False
    monitor_ok = True

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
        except (urllib.error.URLError, OSError) as exc:  # incl. socket timeout
            # Registry unreachable/unauthorized -> we do not KNOW the pin, so this
            # is a monitor problem (monitor_ok=False), not drift. Still red.
            monitor_ok = False
            results.append({"app": name, "status": "GHCR_ERROR", "tag": tag,
                            "detail": f"could not resolve {owner}/{repo}:{tag}: {exc}"})
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
            drift = True
            entry["status"] = "DRIFT"
            entry["detail"] = (f"serving {serving[:19]}… but tag now points at "
                               f"{intended[:19]}… — pin moved without a deploy")
            print(f"::error::{name}: DRIFT — serving {serving} != pin {intended}")
        else:
            entry["status"] = "OK"
            print(f"{name}: OK — serving pinned build {serving[:19]}…")

        results.append(entry)

    write_report({"drift": drift, "monitor_ok": monitor_ok, "apps": results})
    # Both a drifted prod app and a blind checker fail the run; the report says which.
    return 1 if (drift or not monitor_ok) else 0


if __name__ == "__main__":
    sys.exit(main())
