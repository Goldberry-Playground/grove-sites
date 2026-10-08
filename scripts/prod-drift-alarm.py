#!/usr/bin/env python3
"""
prod-drift-alarm.py — turn a drift report into AT MOST ONE honest Discord alarm.

WHY THIS EXISTS (GOL-3138)
--------------------------
Two defects, found together while diagnosing a 14-run red streak
(2026-10-03 -> 2026-10-05) on `prod-deploy-drift.yml`:

1. WRONG MESSAGE. The streak was a dead DigitalOcean token
   (`HTTP Error 401: Unauthorized`), not drift. The old inline alarm had exactly
   one embed — "Prod frontend drift — serving build != pinned build" — so an
   ops-credential outage was reported to Discord as a prod incident, while prod
   was in fact serving exactly its pinned build the whole time. Worse, the real
   condition (prod is UNWATCHED) was never stated, so nobody rotated the token
   for 2.6 days.

2. REPEATED MESSAGE. Each firing re-posted the same alarm. At ~5 scheduled
   firings/day that was tolerable; GOL-3135 step 4 adds event triggers, which
   multiplies the firing rate — and therefore the alarm rate — for whatever the
   check reports. A noisier prod alarm is strictly worse than a late one, so the
   alarm volume has to be decoupled from the firing rate BEFORE the cadence goes
   up. That is what makes the event heartbeat safe at any cadence.

So this layer does three things the inline bash could not:

  * classifies PROD problems apart from MONITOR problems and words the embed
    accordingly ("prod is drifted" vs "the drift check is blind");
  * fingerprints the non-OK state and suppresses a re-post of an UNCHANGED
    fingerprint until RENOTIFY_HOURS have passed;
  * is testable — scripts/ci/prod-drift-alarm.test.mjs drives it end to end.

The run still goes red on EVERY firing while anything is wrong. Suppression only
ever silences Discord, never CI: nothing is hidden from the dashboard.

STATE
-----
Dedupe state rides in the `drift-report` artifact itself (`alarm.key`,
`alarm.last_posted_at`), so there is no new bucket, credential or blast radius.
The workflow hands us the previous run's report as PRIOR_REPORT_FILE; when it is
absent (first run, expired artifact, or a run that produced none) we fail OPEN
and post, because a missed alarm is worse than a duplicate one.

INPUTS (env)
------------
  DRIFT_REPORT_FILE        report from prod-deploy-drift-check.py (read+rewritten)
  PRIOR_REPORT_FILE        optional; previous run's report, for dedupe state
  DISCORD_OPS_WEBHOOK_URL  optional; absent -> warn, still red
  RUN_URL                  optional; link put in the embed footer
  CHECK_OUTCOME            optional; the checker step's `outcome`, as a cross-check
  RENOTIFY_HOURS           optional; default 24
  DISCORD_PAYLOAD_FILE     optional; write the payload here (test/dry-run hook)

EXIT
----
  0  nothing to alarm about
  1  something is wrong (drifted prod OR blind monitor) — regardless of whether
     this run actually posted to Discord
"""
import datetime
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

# A status is BENIGN, a MONITOR problem, or (by elimination) a PROD problem.
# ROLLING_OUT is a healthy in-flight rollout (GOL-3135); SKIPPED is a non-GHCR app.
BENIGN_STATUSES = {"OK", "SKIPPED", "ROLLING_OUT"}
MONITOR_STATUSES = {"MONITOR_ERROR", "GHCR_ERROR"}

DEFAULT_RENOTIFY_HOURS = 24.0
RED = 15158332     # prod is broken
ORANGE = 15844367  # the monitor is broken


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(text):
    if not text:
        return None
    try:
        return datetime.datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=datetime.timezone.utc)
    except (TypeError, ValueError):
        return None


def load_json(path):
    if not path:
        return None
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def alarming_rows(report):
    """The rows worth telling a human about, newest classification applied."""
    rows = []
    for app in report.get("apps") or []:
        if (app.get("status") or "") in BENIGN_STATUSES:
            continue
        rows.append(app)
    return rows


def fingerprint(rows, monitor_ok):
    """Stable id for 'the current bad state', so an unchanged state dedupes.

    Deliberately built from the IDENTITY of each problem (app + status + the
    digests or the error text), never from anything that moves on its own —
    no timestamps, no run ids, no counters. Monitor detail is truncated so a
    long exception repr cannot make two identical 401s look different.
    """
    parts = []
    for row in sorted(rows, key=lambda r: (r.get("app") or "", r.get("status") or "")):
        status = row.get("status") or ""
        if status in MONITOR_STATUSES:
            parts.append(f"{row.get('app')}|{status}|{(row.get('detail') or '')[:120]}")
        else:
            parts.append(f"{row.get('app')}|{status}|"
                         f"{row.get('serving') or ''}|{row.get('intended') or ''}")
    parts.append(f"monitor_ok={bool(monitor_ok)}")
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()[:16]


def build_payload(rows, monitor_problem, run_url, suppressed_note=None):
    fields = [{
        "name": row.get("app") or "(unknown app)",
        "value": (row.get("detail")
                  or f"serving {row.get('serving')} != pin {row.get('intended')}"),
        "inline": False,
    } for row in rows[:20]]
    if not fields:
        fields = [{"name": "unclassified", "value": "See workflow logs", "inline": False}]

    if monitor_problem:
        title = "⚠️ Prod drift check is BLIND — prod is NOT being watched"
        description = (
            "The drift check could not establish what prod is serving, so this is "
            "**not** a statement about prod — it is a monitoring outage. Most often "
            "an expired/rotated `DIGITALOCEAN_TOKEN` in `op://Grove Prod/odoocker` "
            "(GOL-3138). Fix the credential; the next run clears this by itself.")
        colour = ORANGE
    else:
        title = "🚨 Prod frontend drift — serving build != pinned build"
        description = (
            "One or more prod apps are not serving the image their pinned tag points "
            "to. Redeploy with scripts/lib/do-app-redeploy.sh (one create-deployment; "
            "never two back-to-back — GOL-1607).")
        colour = RED

    footer = f"Workflow run: {run_url}" if run_url else "See workflow run logs"
    if suppressed_note:
        footer = f"{suppressed_note} · {footer}"
    return {
        "username": "🚨 Grove Prod Deploy",
        "embeds": [{
            "title": title,
            "description": description,
            "color": colour,
            "fields": fields,
            "footer": {"text": footer},
        }],
    }


def post_discord(url, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
        return True
    except (urllib.error.URLError, OSError) as exc:
        print(f"::warning::Discord webhook failed ({exc}) — problem still detected, "
              "see logs")
        return False


def main():
    report_file = os.environ.get("DRIFT_REPORT_FILE", "drift-report.json").strip()
    report = load_json(report_file)

    if report is None:
        # The checker now always writes a report, so getting here means it died
        # hard (OOM, killed, traceback before the write). Treat as a monitor
        # outage rather than inventing a prod incident.
        report = {
            "drift": False,
            "monitor_ok": False,
            "monitor_error": f"no readable drift report at {report_file!r}",
            "apps": [{"app": "(all prod apps)", "status": "MONITOR_ERROR",
                      "detail": "the drift checker produced no report — see run logs"}],
        }

    rows = alarming_rows(report)
    monitor_ok = report.get("monitor_ok", True)

    # Cross-check against the checker's exit: a non-zero exit with nothing to show
    # is itself a monitor problem. Without this, a future early-return path that
    # forgets to write a row would silently report "no drift" on a red run.
    if not rows and os.environ.get("CHECK_OUTCOME") == "failure":
        monitor_ok = False
        rows = [{"app": "(all prod apps)", "status": "MONITOR_ERROR",
                 "detail": "the drift checker exited non-zero but reported no "
                           "problem — see run logs"}]

    if not rows:
        print("All prod frontends serve their pinned build. No drift.")
        report["alarm"] = {"key": None, "posted": False, "last_posted_at": None}
        with open(report_file, "w") as fh:
            json.dump(report, fh, indent=2)
        return 0

    monitor_problem = (not monitor_ok) or all(
        (r.get("status") or "") in MONITOR_STATUSES for r in rows)
    key = fingerprint(rows, monitor_ok)

    prior = (load_json(os.environ.get("PRIOR_REPORT_FILE", "").strip()) or {})
    prior_alarm = prior.get("alarm") or {}
    prior_key = prior_alarm.get("key")
    prior_posted_at = parse_iso(prior_alarm.get("last_posted_at"))

    try:
        renotify_hours = float(os.environ.get("RENOTIFY_HOURS") or DEFAULT_RENOTIFY_HOURS)
    except ValueError:
        renotify_hours = DEFAULT_RENOTIFY_HOURS

    now = now_utc()
    age_hours = None
    if prior_posted_at is not None:
        age_hours = (now - prior_posted_at).total_seconds() / 3600.0

    unchanged = (prior_key == key and prior_posted_at is not None)
    within_window = unchanged and age_hours is not None and age_hours < renotify_hours
    should_post = not within_window

    kind = "MONITOR OUTAGE" if monitor_problem else "PROD DRIFT"
    print(f"::error::{kind} detected ({len(rows)} affected) — fingerprint {key}")
    for row in rows:
        print(f"  {row.get('app')}: {row.get('status')} — {row.get('detail') or ''}")

    posted = False
    webhook = os.environ.get("DISCORD_OPS_WEBHOOK_URL", "").strip()
    if should_post:
        note = None
        if unchanged:
            note = f"unchanged for {age_hours:.1f}h — re-notify every {renotify_hours:g}h"
        payload = build_payload(rows, monitor_problem, os.environ.get("RUN_URL", ""), note)

        dry_file = os.environ.get("DISCORD_PAYLOAD_FILE", "").strip()
        if dry_file:
            with open(dry_file, "w") as fh:
                json.dump(payload, fh, indent=2)

        if webhook:
            posted = post_discord(webhook, payload)
        elif dry_file:
            posted = True  # dry-run: treat as delivered so dedupe can be exercised
        else:
            print("::warning::No Discord webhook — problem detected but not alarmed")
    else:
        print(f"Discord post suppressed: same fingerprint {key} already alarmed "
              f"{age_hours:.1f}h ago (< {renotify_hours:g}h re-notify window). "
              "The run is still red.")

    # Carry the last-posted time forward so a long unchanged outage keeps
    # deduping across runs instead of re-alarming on the next firing.
    report["alarm"] = {
        "key": key,
        "posted": posted,
        "kind": "monitor" if monitor_problem else "prod",
        "last_posted_at": iso(now) if posted else prior_alarm.get("last_posted_at"),
    }
    with open(report_file, "w") as fh:
        json.dump(report, fh, indent=2)

    return 1


if __name__ == "__main__":
    sys.exit(main())
