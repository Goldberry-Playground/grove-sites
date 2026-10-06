#!/usr/bin/env bash
# Arm auto-merge under the agent App identity -- the PROACTIVE half of the
# merge-queue enqueue-identity fix (GOL-3118, parent GOL-2524).
#
# WHY THIS EXISTS
#
# GitHub never creates workflow runs for events triggered by the default
# `GITHUB_TOKEN`. With a merge queue on `main`, `auto-approve.yml`'s
# `gh pr merge --squash` is an ENQUEUE, and an enqueue made by `GITHUB_TOKEN`
# builds a merge group that no `merge_group` workflow ever runs on: no required
# check reports, and GitHub ejects the PR unmerged ~30 min later.
# `merge-queue-rescue.sh` cleans that up AFTER the fact, once per PR, forever.
#
# The permanent fix was thought to require an App private key in
# `secrets.MERGE_QUEUE_APP_PRIVATE_KEY` so the workflow could mint a non-
# `GITHUB_TOKEN` identity for the enqueue call. It does not. Measured on
# 2026-10-06:
#
#   AUTO-MERGE INHERITS THE IDENTITY OF WHOEVER ENABLED IT.
#
# When auto-merge is armed on a PR, GitHub performs the eventual enqueue
# attributed to the identity that armed it -- and that enqueue creates runs
# normally. Evidence (`AutoMergeEnabledEvent.actor` vs the resulting
# `AddedToMergeQueueEvent.enqueuer`, grove-sites):
#
#   PR #921  armed by agenticos-developer 19:50:49Z -> enqueued by
#            agenticos-developer[bot] 20:10:25Z (20 min later, when checks went
#            green) -> ONE enqueue -> merged
#   PR #923  armed 20:12:22Z -> enqueued by the App 20:15:45Z -> merged
#   PR #933  armed 20:26:05Z -> enqueued by the App 20:31:54Z -> merged
#   PR #900  armed by EngineeringMoonBear -> enqueued as that human -> merged
#
#   #921's 20-minute gap is the load-bearing detail: arming happens BEFORE the
#   checks are green, GitHub does the waiting, and the enqueue it makes later
#   still carries the arming identity.
#
# Confirmed deliberately, same queue, 68 seconds apart:
#
#   PR #990  enqueued by `github-actions` 02:05:51Z, group ba3e3f57 ->  0 runs
#   PR #987  armed as the App  02:06:59Z, group d16f97f1          ->  7 runs
#
# So the enqueue identity does NOT have to come from inside the workflow. Agents
# already hold one: every agent PR is authored by `agenticos-developer[bot]`
# using a broker-minted installation token. Arming auto-merge with that same
# token at PR-open time makes every subsequent enqueue healthy, with no Actions
# variable, no Actions secret, and no App private key copied anywhere.
#
# That matters beyond convenience. ADR-0001 keeps the App private key in
# `gh-token-broker` alone ("agents never see the root key"), and
# `.github/workflows/README-preview.md` commits CI to reading credentials from
# 1Password at runtime rather than storing them ("no static ... tokens live in
# GitHub secrets"). `MERGE_QUEUE_APP_PRIVATE_KEY` would be the first long-lived
# root credential in Actions secrets, in three repos, to buy a capability the
# broker already gives away.
#
# WHY A DEAD ENTRY IS WORSE THAN IT LOOKS
#
# The merge queue is sequential. A dead entry at position 1 holds up every
# healthy entry behind it for the full eviction timeout -- on 2026-10-06, #990's
# dead group stalled #987 even though #987 had 7 green runs. The cost of a wedge
# is not one PR; it is the whole queue.
#
# STEADY STATE vs BACKSTOP
#
# The steady state is for whatever opens an agent PR to arm it in the same
# breath (see docs/runbooks/merge-queue-enqueue-identity.md). This script is the
# backstop and the backlog drain: it sweeps already-open PRs and arms the ones
# that are safe to arm.
#
# It only ever arms PRs authored by the agent App. `auto-approve.yml` approves
# maintainer PRs but deliberately does not enqueue them, so that a human keeps
# control over when their own PR merges; arming theirs would take that back.
#
# This bypasses NO gate. Auto-merge is GitHub's own mechanism and still requires
# every required review and every required status check before it merges --
# including the protected-paths human review that `auto-approve.yml` withholds
# its approval for. Arming a PR only decides WHO enqueues it, not WHETHER it may
# merge.
#
# Do NOT run this from a GitHub Actions job on the default `GITHUB_TOKEN`: that
# is the identity that causes the wedge, so it would arm auto-merge as
# `github-actions` and rebuild the same dead group.
#
#   Dry run (default):   scripts/ci/merge-queue-arm-automerge.sh
#   Apply:               scripts/ci/merge-queue-arm-automerge.sh --apply
#   Every open PR:       ARM_UNAPPROVED=1 scripts/ci/merge-queue-arm-automerge.sh --apply
#   Other repo:          REPO=Goldberry-Playground/odoocker-goldberrygrove ... --apply
#
# Env:
#   GH_TOKEN_BROKER_URL    broker base URL      (default http://gh-token-broker:9099)
#   GH_BROKER_API_KEY_FILE broker API key path  (default /paperclip/gh-broker.key)
#   REPO                   owner/name           (default Goldberry-Playground/grove-sites)
#   BRANCH                 queue branch         (default main)
#   APP_LOGIN              arming identity      (default agenticos-developer)
#   APP_AUTHOR_LOGIN       PR-author login to match (default $APP_LOGIN)
#   ARM_UNAPPROVED         1 = arm PRs that are not approved yet (default 0)
#
# ARM_UNAPPROVED is the conservative/steady-state switch. Default 0 arms only
# already-APPROVED PRs -- exactly the set `auto-approve.yml` has already decided
# to merge, so arming them changes nothing but the enqueuing identity. Setting
# it to 1 arms open PRs before approval, which is the real steady state (GitHub
# waits for the gates) but means a protected-path PR merges the moment a human
# approves it, instead of waiting for a separate enqueue. That is a change in
# when a reviewer's approval becomes final, so it is opt-in.

set -euo pipefail

REPO="${REPO:-Goldberry-Playground/grove-sites}"
BRANCH="${BRANCH:-main}"
BROKER_URL="${GH_TOKEN_BROKER_URL:-http://gh-token-broker:9099}"
BROKER_KEY_FILE="${GH_BROKER_API_KEY_FILE:-/paperclip/gh-broker.key}"
APP_LOGIN="${APP_LOGIN:-agenticos-developer}"
ARM_UNAPPROVED="${ARM_UNAPPROVED:-0}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

if [ ! -r "$BROKER_KEY_FILE" ]; then
  log "FATAL: broker key not readable at $BROKER_KEY_FILE"; exit 1
fi

TOKEN="$(curl -fsS -H "Authorization: Bearer $(cat "$BROKER_KEY_FILE")" \
  "$BROKER_URL/token?owner=$OWNER&repo=$NAME" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

gh_graphql() { curl -fsS -X POST -H "Authorization: Bearer $TOKEN" https://api.github.com/graphql -d "$1"; }

log "repo=$REPO branch=$BRANCH app=$APP_LOGIN arm_unapproved=$ARM_UNAPPROVED apply=$APPLY"

# Query bodies are built with printf, not a nested heredoc: a heredoc inside
# command substitution silently yields an empty body here (same trap as
# merge-queue-rescue.sh).
PR_FIELDS='number id headRefOid isDraft state reviewDecision mergeable author{login} autoMergeRequest{enabledBy{login}}'
QUERY="$(printf '{"query":"query{repository(owner:\\"%s\\",name:\\"%s\\"){pullRequests(states:OPEN,first:100){nodes{%s}} mergeQueue(branch:\\"%s\\"){entries(first:100){nodes{pullRequest{number}}}}}}"}' \
  "$OWNER" "$NAME" "$PR_FIELDS" "$BRANCH")"

GRAPH="$(gh_graphql "$QUERY")"

# One JSON object per line: {"number","action","reason","id","headRefOid"}.
# Passed through the environment, not a pipe -- a heredoc-sourced program takes
# over stdin, so piped data would never reach it.
DECISIONS="$(APP_LOGIN="$APP_LOGIN" APP_AUTHOR_LOGIN="${APP_AUTHOR_LOGIN:-$APP_LOGIN}" ARM_UNAPPROVED="$ARM_UNAPPROVED" GRAPH_JSON="$GRAPH" python3 <<'PYEOF'
import json, os

app = os.environ["APP_LOGIN"]
# The App's PR-author login has no "[bot]" suffix in GraphQL's `author.login`,
# while `enabledBy.login` on an auto-merge request matches APP_LOGIN exactly.
# Both read `agenticos-developer` here, but they are different fields and are
# resolved separately so a future rename cannot silently conflate them.
app_author = os.environ.get("APP_AUTHOR_LOGIN", app)
arm_unapproved = os.environ.get("ARM_UNAPPROVED", "0") == "1"
repo = json.loads(os.environ["GRAPH_JSON"])["data"]["repository"]

# A PR already in the queue cannot be fixed by arming auto-merge: the entry (and
# therefore its identity) already exists. If that entry is dead it is
# merge-queue-rescue.sh's job, not this script's.
queued = set()
for e in ((repo.get("mergeQueue") or {}).get("entries") or {}).get("nodes") or []:
    pr = e.get("pullRequest") or {}
    if pr.get("number") is not None:
        queued.add(pr["number"])

def classify(pr):
    """-> (action, reason). 'arm' or 'skip'. Conservative in every unclear case."""
    if pr.get("state") != "OPEN":
        return "skip", "not open (state=%s)" % pr.get("state")
    # GitHub rejects enablePullRequestAutoMerge on a draft, and a draft is an
    # explicit "not yet" from its author.
    if pr.get("isDraft"):
        return "skip", "draft"
    # auto-approve.yml deliberately approves maintainer PRs but never
    # enqueues/merges them -- "the human keeps full control over WHEN their PR
    # merges". Arming auto-merge on someone else's PR would take exactly that
    # control away, asynchronously and without telling them. A dry run on
    # 2026-10-06 would have armed grove-sites #941 (EngineeringMoonBear's,
    # APPROVED, checks still pending) before this rule existed.
    author = (pr.get("author") or {}).get("login")
    if author != app_author:
        return "skip", "authored by %s, not %s; its author decides when it merges" % (author, app_author)
    if pr["number"] in queued:
        return "skip", "already in the merge queue -- use merge-queue-rescue.sh if its group is dead"
    amr = pr.get("autoMergeRequest")
    if amr:
        who = (amr.get("enabledBy") or {}).get("login")
        if who == app:
            return "skip", "already armed by %s" % app
        # Someone else -- a human, or another identity -- armed this. Re-arming
        # would mean disabling theirs first, which silently takes a merge
        # decision away from its owner.
        return "skip", "armed by %s; leaving it alone" % who
    # CONFLICTING is the only mergeable value we refuse. UNKNOWN just means
    # GitHub has not computed the merge commit yet (it is lazy, and most PRs
    # read UNKNOWN on a cold query) -- arming is still correct, and
    # expectedHeadOid makes a racing push fail the mutation rather than arm a
    # stale head.
    if pr.get("mergeable") == "CONFLICTING":
        return "skip", "conflicting; resolve the conflict first"
    if not arm_unapproved and pr.get("reviewDecision") != "APPROVED":
        return "skip", "not approved (reviewDecision=%s); set ARM_UNAPPROVED=1 to arm pre-approval" % pr.get("reviewDecision")
    return "arm", "eligible (reviewDecision=%s, mergeable=%s)" % (pr.get("reviewDecision"), pr.get("mergeable"))

for pr in repo["pullRequests"]["nodes"]:
    action, reason = classify(pr)
    print(json.dumps({
        "number": pr["number"], "action": action, "reason": reason,
        "id": pr["id"], "headRefOid": pr["headRefOid"],
    }))
PYEOF
)"

printf '%s\n' "$DECISIONS" | python3 -c '
import json, sys
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    d = json.loads(line)
    if d["action"] == "skip":
        print("  skip #%-5s %s" % (d["number"], d["reason"]))
'

ARM="$(printf '%s\n' "$DECISIONS" | python3 -c '
import json, sys
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    d = json.loads(line)
    if d["action"] == "arm":
        print("%s\t%s\t%s" % (d["number"], d["id"], d["headRefOid"]))
')"

if [ -z "$ARM" ]; then
  log "nothing to arm"; exit 0
fi

COUNT="$(printf '%s\n' "$ARM" | grep -c .)"
log "eligible to arm: $COUNT"

rc=0
while IFS=$'\t' read -r num node sha; do
  [ -n "$num" ] || continue
  if [ "$APPLY" -eq 0 ]; then
    log "DRY-RUN would arm #$num (head ${sha:0:9}) as $APP_LOGIN"
    continue
  fi
  # expectedHeadOid: if the head moved since the query, the mutation fails
  # instead of arming a head nobody has reviewed.
  MUT="$(printf '{"query":"mutation{enablePullRequestAutoMerge(input:{pullRequestId:\\"%s\\",mergeMethod:SQUASH,expectedHeadOid:\\"%s\\"}){pullRequest{number}}}"}' "$node" "$sha")"
  if OUT="$(gh_graphql "$MUT" 2>&1)" && ! printf '%s' "$OUT" | grep -q '"errors"'; then
    log "armed #$num (head ${sha:0:9}) as $APP_LOGIN"
  else
    # Never fatal: one PR GitHub refuses to arm (clean status, stale head,
    # queue race) must not stop the sweep for the rest.
    log "WARN could not arm #$num: $(printf '%s' "$OUT" | tr '\n' ' ' | cut -c1-240)"
    rc=1
  fi
done <<< "$ARM"

exit "$rc"
