# Scheduled design-sync drift detector (GOL-411)

The runbook for the Paperclip routine that notices an in-app retheme within days
instead of at the next push attempt. The deterministic half is
`scripts/ds-drift-scan.mjs`; this file is the half a scheduler has to carry.

## Why a routine and not a CI job

Reading the published side needs a DesignSync `get_file` call. DesignSync
authenticates through a claude.ai login that a GitHub Actions runner does not
have and cannot obtain — there is no API key or CLI to hand it. The GOL-380 CI
gate (`ds-theme-drift` in `ci.yml`) works on a bare checkout precisely because it
is pure concatenation: no install, no network, no auth. The fetch half cannot
join it. A Paperclip routine wakes an agent that *does* hold that auth.

## Why it opens an issue instead of failing a build

Published values change out-of-band, by a human, on their schedule. A gate that
reddens unrelated PRs when Abigail picks a new gold gets muted within a week, and
a muted detector is worse than none — it reads as coverage while detecting
nothing. An issue routes to a person and waits, blocking no one.

## What it is not

A detector fires *after* the damage. `ds-guard.mjs` (GOL-402) is what actually
prevents a clobber, and it is the thing that matters. This only shortens the time
to notice. Do not let its existence justify weakening the guard.

## Coverage — read this before trusting a green run

Only brands with a committed `.design-sync/baseline.<brand>.json` are checked:

| brand | covered | why |
|---|---|---|
| `goldberry` | yes | baseline adopted 2026-07-15 |
| `hub` | yes | baseline adopted 2026-07-15 |
| `ggg` | **no** | no baseline — see below |
| `nursery` | **no** | no baseline — see below |

`ggg` and `nursery` have circular provenance (GOL-404): we cannot currently tell
which published values are Abigail's and which are ours. Adopting a baseline for
them would *arm* a clobber rather than prevent one — it would tell the guard to
wave through the next push, which would overwrite whatever is hers. They stay
uncovered until Abigail confirms which values are hers (GOL-404/406). That is a
brand decision, not a scheduling one.

The scan reports these as `uncovered` and names them in any issue it opens, so a
green run never reads as "all four brands are fine".

## Cadence

Weekly. The window this closes is "months (next push) → days", and a retheme is a
deliberate human act, not a continuous process — hourly polling would burn four
`get_file` fetches per run to re-learn the same answer. Weekly gets essentially
all the value. It is also four bundle fetches through an agent's context per run,
which is not free.

## The routine prompt

```
Run the scheduled design-sync drift scan (GOL-411).

For each brand with a committed .design-sync/baseline.<brand>.json — currently
goldberry (937e8bd2-8fdb-4e4f-8181-b69e91b067f2) and hub
(49cf4144-c527-4831-a446-dbfc30a452ef); re-read the baselines, do not trust this
list — fetch the live published bundle:

  DesignSync(method: "get_file", projectId: "<projectId>", path: "_ds_bundle.css")

Save each to .ds-sync/published/<brand>/_ds_bundle.css (gitignored), then run:

  node scripts/ds-drift-scan.mjs

It prints a JSON report. If shouldOpenIssue is false, exit without action and do
not post anything — a quiet detector should be quiet.

If shouldOpenIssue is true:
1. Search open issues for the report's `fingerprint` in the body. If one exists,
   add a comment to it instead of opening a duplicate.
2. Otherwise open an issue titled `issueTitle` with body `issueBody`, plus a
   final line `fingerprint: <fingerprint>`. Assign to Frontend-Iris. Priority
   medium — a retheme waiting on a brand conversation is not an outage.

Do NOT resolve the drift yourself. Do not run ds-build.sh, do not --adopt, do not
--force. Published values are a brand owner's work with no version history behind
them; deciding they are disposable is Abigail's call (via CMO-Sora), not the
routine's. The issue is the deliverable.
```

## Arming it

Arming a recurring routine is a governance action, not a UI change — it needs
explicit sign-off before the timer is enabled (CEO; Engineering-Alice is no
longer on the roster). See the GOL-411 thread for the approval.
