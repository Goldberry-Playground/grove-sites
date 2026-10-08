#!/usr/bin/env python3
"""
prod-credential-expiry-warn.py — warn BEFORE a prod credential expires.

WHY THIS EXISTS (GOL-3140)
--------------------------
From 2026-10-03 to 2026-10-05 `prod-deploy-drift.yml` was red for 2.6 days
because `op://Grove Prod/odoocker/DIGITALOCEAN_TOKEN` had stopped
authenticating (`HTTP Error 401: Unauthorized`). Prod was fine; prod
MONITORING was blind. GOL-3138 fixed the *reporting* — the alarm now says "the
drift check is BLIND" and names the credential instead of inventing a prod
incident. But detection was still reactive: we learned the token was dead only
once it was already dead, and only because this one workflow happened to use
it. The same token is the DO API key for the preview-droplet pipeline,
Spaces/app automation and scripts/lib/do-app-redeploy.sh — a silent expiry is a
broad, quiet outage.

DigitalOcean PATs now default to a 90-day expiry and DO exposes no public
endpoint to introspect your own PAT's expiry, so this cannot be read back from
the API. It can only be RECORDED once and watched. The `odoocker` 1Password
item already carries an `expires` DATE field, so the record costs nothing new.

WHAT IT DOES
------------
Reads the recorded expiry date, decides a tier, and posts AT MOST ONE Discord
ops embed per tier transition:

  QUIET    more than WARN_DAYS out            -> nothing
  WARN     within WARN_DAYS (default 14)      -> "rotate this soon" (yellow)
  URGENT   within URGENT_DAYS (default 3)     -> "rotate this now" (orange)
  EXPIRED  the date has passed                -> "already dead" (red)

The embed is deliberately worded as a CHORE, and this script ALWAYS exits 0: an
approaching expiry must never turn a prod monitoring run red, because a red run
is the signal reserved for "prod is drifted" and "the drift check is blind"
(GOL-3138). Making a calendar reminder fail CI would re-create exactly the
alarm-fatigue this whole family of issues is about.

INERT UNTIL RECORDED
--------------------
While `expires` is empty this script prints one `::notice` naming the owner of
the one-minute chore and posts nothing. `op read` on an EMPTY 1Password field
exits 0 with empty output (verified against the live item), so referencing the
field is safe today; a MISSING field would exit 1 and fail the whole
load-secrets step, which is why the pre-existing `expires` field is reused
rather than a new `DIGITALOCEAN_TOKEN_EXPIRES` one being requested.

NOTE ON SCOPE: the `odoocker` item holds eight credentials and has exactly one
`expires` field, so by adoption `expires` means the DIGITALOCEAN_TOKEN — the
one with a known hard expiry. A second watched credential should get its own
`<NAME>_EXPIRES` field and its own invocation of this script, not a second
meaning for this field.

DATE FORMAT TOLERANCE
---------------------
1Password's DATE rendering is not contractually fixed (it stores an epoch and
renders per locale), and the live field is empty so the exact string could not
be observed. parse_expiry() therefore accepts epoch seconds/millis, ISO dates
and datetimes, slash dates and spelled-out months — and every message echoes
the RESOLVED date, so a misparse is visible to a human instead of silent.
A date implausibly far from now (see PLAUSIBLE_YEARS) is treated as
unparseable, which is what stops an epoch-unit mix-up from announcing 1970 as
an expired credential.

STATE
-----
Dedupe state rides in the `drift-report` artifact alongside the drift alarm's
own state (`credential_expiry.tier`, `.last_posted_at`) — no new bucket,
credential or blast radius. The previous run's report arrives as
PRIOR_STATE_FILE; when it is absent we fail OPEN and post, because a missed
rotation warning is worse than a duplicate one.

INPUTS (env)
------------
  CREDENTIAL_EXPIRES      the recorded expiry date; empty -> inert
  CREDENTIAL_LABEL        human name for the embed (default DIGITALOCEAN_TOKEN)
  CREDENTIAL_REF          op:// reference quoted in the embed
  WARN_DAYS               default 14
  URGENT_DAYS             default 3
  STATE_FILE              report to append our block to (default drift-report.json)
  PRIOR_STATE_FILE        previous run's report, for dedupe state
  DISCORD_OPS_WEBHOOK_URL absent -> notice only
  DISCORD_PAYLOAD_FILE    write the payload here (test/dry-run hook)
  RUN_URL                 link put in the embed footer
  NOW_OVERRIDE            ISO instant, tests only

EXIT
----
  0  always. An expiring credential is a chore, not an incident.
"""
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.request

DEFAULT_WARN_DAYS = 14.0
DEFAULT_URGENT_DAYS = 3.0

# Re-notify cadence per tier. A far-off chore should nag weekly; an imminent or
# already-dead credential should nag daily. This, not the firing rate, is what
# bounds Discord volume — the same property that makes GOL-3135's event
# heartbeat safe for the drift alarm.
RENOTIFY_HOURS = {"WARN": 168.0, "URGENT": 24.0, "EXPIRED": 24.0}

# A recorded expiry further than this from now is treated as a typo/unit
# mix-up rather than believed. Without this rail, epoch-millis read as epoch
# seconds resolves to 1970 and would announce a healthy token as EXPIRED.
PLAUSIBLE_YEARS = 10

YELLOW = 16776960
ORANGE = 15844367
RED = 15158332

TIER_STYLE = {
    "WARN": (YELLOW, "🗓️", "expires soon — schedule the rotation"),
    "URGENT": (ORANGE, "⏳", "expires in days — rotate now"),
    "EXPIRED": (RED, "💀", "HAS EXPIRED — prod automation is running on a dead key"),
}

# Accepted date renderings, most specific first. MM/DD is tried before DD/MM
# because the 1Password account is US-locale; an unambiguous DD/MM date (day
# > 12) still parses, and every message echoes the resolved date so a
# genuinely ambiguous one (e.g. 03/04) is caught by eye rather than silently.
DATE_FORMATS = (
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%m/%d/%Y",
    "%d/%m/%Y",
    "%B %d, %Y",
    "%b %d, %Y",
    "%d %B %Y",
    "%d %b %Y",
)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_instant(text):
    if not text:
        return None
    try:
        return datetime.datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=datetime.timezone.utc)
    except (TypeError, ValueError):
        return None


def now_utc():
    return (parse_instant(os.environ.get("NOW_OVERRIDE", "").strip())
            or datetime.datetime.now(datetime.timezone.utc))


def load_json(path):
    if not path:
        return None
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def parse_expiry(raw, now):
    """Resolve a recorded expiry date, or None if it cannot be trusted.

    Returns an END-OF-DAY UTC instant for date-only input: a credential
    recorded as expiring on the 31st is alive for all of the 31st, and
    rounding it down to midnight would announce it dead a day early.
    """
    text = (raw or "").strip()
    if not text:
        return None

    parsed = None
    # An epoch may arrive with a fractional part ("1767225599.000").
    digits = text.split(".", 1)[0] if re.fullmatch(r"\d+(\.\d+)?", text) else text
    if digits.isdigit():
        value = int(digits)
        # 13 digits is epoch millis, 10 is epoch seconds. Anything else is not
        # an epoch we recognise, and the plausibility rail below rejects it.
        if len(digits) >= 12:
            value //= 1000
        try:
            parsed = datetime.datetime.fromtimestamp(value, datetime.timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    else:
        for fmt in DATE_FORMATS:
            try:
                parsed = datetime.datetime.strptime(text, fmt).replace(
                    tzinfo=datetime.timezone.utc)
            except ValueError:
                continue
            if "%H" not in fmt:
                # Date-only: the credential lives to the end of that day.
                parsed = parsed.replace(hour=23, minute=59, second=59)
            break

    if parsed is None:
        return None
    if abs((parsed - now).days) > PLAUSIBLE_YEARS * 366:
        return None
    return parsed


def classify(days_left, warn_days, urgent_days):
    if days_left < 0:
        return "EXPIRED"
    if days_left <= urgent_days:
        return "URGENT"
    if days_left <= warn_days:
        return "WARN"
    return "QUIET"


def human_remaining(days_left):
    if days_left < 0:
        return f"expired {abs(days_left):.1f} days ago"
    if days_left < 1:
        return "expires in under a day"
    return f"{days_left:.1f} days left"


def build_payload(tier, label, ref, expires_at, days_left, run_url, note=None):
    colour, icon, headline = TIER_STYLE[tier]
    description = (
        f"`{label}` {headline}.\n\n"
        f"**Recorded expiry:** {expires_at.strftime('%Y-%m-%d')} "
        f"({human_remaining(days_left)})\n"
        f"**Stored at:** `{ref}`\n\n"
        "Rotate on the DigitalOcean API-tokens page, write the new value into "
        "1Password, then update the `expires` field to the new date — the "
        "warning only works while that date is current. This is a chore, not an "
        "incident: the run stays green.")
    if tier == "EXPIRED":
        description += (
            "\n\nUntil it is rotated the prod drift check is BLIND and the "
            "preview-droplet pipeline cannot reach the DO API (GOL-3138).")

    footer = f"Workflow run: {run_url}" if run_url else "See workflow run logs"
    if note:
        footer = f"{note} · {footer}"
    return {
        "username": "🔑 Grove Prod Credentials",
        "embeds": [{
            "title": f"{icon} Prod credential {tier.lower()}: {label}",
            "description": description,
            "color": colour,
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
        print(f"::warning::Discord webhook failed ({exc}) — credential expiry still "
              "recorded in the run log, see above")
        return False


def write_state(path, block):
    """Merge our block into the shared report WITHOUT clobbering the drift alarm.

    This runs after prod-drift-alarm.py has rewritten the report with its own
    `alarm` block and before the upload step, so a blind overwrite here would
    destroy the drift alarm's dedupe state and make it re-post on every firing.
    """
    if not path:
        return
    report = load_json(path)
    if not isinstance(report, dict):
        report = {}
    report["credential_expiry"] = block
    try:
        with open(path, "w") as fh:
            json.dump(report, fh, indent=2)
    except OSError as exc:
        print(f"::warning::could not persist expiry dedupe state to {path!r} ({exc}) "
              "— the next run will fail open and re-post")


def float_env(name, default):
    try:
        return float(os.environ.get(name) or default)
    except ValueError:
        return default


def main():
    label = os.environ.get("CREDENTIAL_LABEL", "").strip() or "DIGITALOCEAN_TOKEN"
    ref = (os.environ.get("CREDENTIAL_REF", "").strip()
           or "op://Grove Prod/odoocker/DIGITALOCEAN_TOKEN")
    state_file = os.environ.get("STATE_FILE", "drift-report.json").strip()
    raw = os.environ.get("CREDENTIAL_EXPIRES", "")
    now = now_utc()

    if not raw.strip():
        # Inert, by design: the ops 1Password SA is read-only on Grove Prod
        # (GOL-2526), so only a human can put the date there.
        print(f"::notice title=Credential expiry not recorded::`expires` is empty on "
              f"{ref} — nobody can be warned before {label} dies. Set it to the "
              "token's expiry date from the DigitalOcean API-tokens page (one "
              "minute, @EngineeringMoonBear). No Discord post from this run.")
        write_state(state_file, {"tier": "UNRECORDED", "posted": False,
                                 "last_posted_at": None, "expires_at": None})
        return 0

    expires_at = parse_expiry(raw, now)
    if expires_at is None:
        # Never guess. A date we cannot trust must not become an alarm, in
        # either direction — not a false "expired", not a false silence.
        print(f"::warning title=Credential expiry unreadable::Could not read an "
              f"expiry date from the `expires` field on {ref}. Expected e.g. "
              f"2026-12-31, got {raw.strip()[:40]!r}. Nothing was posted and "
              f"{label} is NOT being watched.")
        write_state(state_file, {"tier": "UNREADABLE", "posted": False,
                                 "last_posted_at": None, "expires_at": None})
        return 0

    warn_days = float_env("WARN_DAYS", DEFAULT_WARN_DAYS)
    urgent_days = float_env("URGENT_DAYS", DEFAULT_URGENT_DAYS)
    days_left = (expires_at - now).total_seconds() / 86400.0
    tier = classify(days_left, warn_days, urgent_days)

    print(f"{label} expires {expires_at.strftime('%Y-%m-%d')} "
          f"({human_remaining(days_left)}) — tier {tier}")

    if tier == "QUIET":
        # Reset the dedupe state so a freshly rotated credential warns again on
        # its NEXT approach instead of being suppressed by the old tier.
        write_state(state_file, {"tier": "QUIET", "posted": False,
                                 "last_posted_at": None,
                                 "expires_at": iso(expires_at)})
        return 0

    prior = (load_json(os.environ.get("PRIOR_STATE_FILE", "").strip()) or {})
    prior_block = prior.get("credential_expiry") or {}
    prior_tier = prior_block.get("tier")
    prior_posted_at = parse_instant(prior_block.get("last_posted_at"))

    renotify = RENOTIFY_HOURS[tier]
    age_hours = None
    if prior_posted_at is not None:
        age_hours = (now - prior_posted_at).total_seconds() / 3600.0

    # A tier change always speaks. An unchanged tier re-states itself only once
    # the tier's own re-notify window has elapsed.
    unchanged = prior_tier == tier and prior_posted_at is not None
    should_post = not (unchanged and age_hours is not None and age_hours < renotify)

    posted = False
    if should_post:
        note = (f"unchanged for {age_hours:.1f}h — re-notify every {renotify:g}h"
                if unchanged else None)
        payload = build_payload(tier, label, ref, expires_at, days_left,
                                os.environ.get("RUN_URL", ""), note)

        dry_file = os.environ.get("DISCORD_PAYLOAD_FILE", "").strip()
        if dry_file:
            with open(dry_file, "w") as fh:
                json.dump(payload, fh, indent=2)

        webhook = os.environ.get("DISCORD_OPS_WEBHOOK_URL", "").strip()
        if webhook:
            posted = post_discord(webhook, payload)
        elif dry_file:
            posted = True  # dry-run: treat as delivered so dedupe is exercisable
        else:
            print("::warning::No Discord webhook — credential expiry not alarmed")
    else:
        print(f"Discord post suppressed: still {tier}, already warned "
              f"{age_hours:.1f}h ago (< {renotify:g}h re-notify window).")

    write_state(state_file, {
        "tier": tier,
        "posted": posted,
        "last_posted_at": iso(now) if posted else prior_block.get("last_posted_at"),
        "expires_at": iso(expires_at),
        "days_left": round(days_left, 2),
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
