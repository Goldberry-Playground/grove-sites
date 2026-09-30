#!/usr/bin/env bash
# Merge-queue wedge rescue (GOL-2524 / GOL-2790).
#
# Finds merge-queue entries sitting in a DEAD merge group -- enqueued by
# `github-actions`, whose group commit GitHub refuses to dispatch workflows for --
# and re-enqueues them under the `agenticos-developer` App identity so the
# required checks actually run.
#
# This bypasses no gate. It only re-runs checks the dead group never ran, and it
# only touches an entry that is already APPROVED and mergeable -- the same bar it
# cleared to be enqueued in the first place.
#
# Runs from the agent box with no human in the loop: the App token comes from the
# gh-token-broker sidecar. Do NOT run this from a GitHub Actions job using the
# default GITHUB_TOKEN -- that is the identity that causes the wedge, so it would
# just build another dead group.
#
#   Dry run (default):  scripts/ci/merge-queue-rescue.sh
#   Apply:              scripts/ci/merge-queue-rescue.sh --apply
#   Other repo:         REPO=Goldberry-Playground/odoocker-goldberrygrove ... --apply
#
# Env:
#   GH_TOKEN_BROKER_URL    broker base URL         (default http://gh-token-broker:9099)
#   GH_BROKER_API_KEY_FILE broker API key path     (default /paperclip/gh-broker.key)
#   REPO                   owner/name              (default Goldberry-Playground/grove-sites)
#   BRANCH                 queue branch            (default main)
#   GRACE_SECONDS          min entry age to act on (default 180)

set -euo pipefail

REPO="${REPO:-Goldberry-Playground/grove-sites}"
BRANCH="${BRANCH:-main}"
GRACE_SECONDS="${GRACE_SECONDS:-180}"
BROKER_URL="${GH_TOKEN_BROKER_URL:-http://gh-token-broker:9099}"
BROKER_KEY_FILE="${GH_BROKER_API_KEY_FILE:-/paperclip/gh-broker.key}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

# The identity GitHub suppresses merge_group dispatch for. Entries enqueued by
# anyone else are healthy by construction and are never touched.
DEAD_ENQUEUER="github-actions"

log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

if [ ! -r "$BROKER_KEY_FILE" ]; then
  log "FATAL: broker key not readable at $BROKER_KEY_FILE"; exit 1
fi

TOKEN="$(curl -fsS -H "Authorization: Bearer $(cat "$BROKER_KEY_FILE")" \
  "$BROKER_URL/token?owner=$OWNER&repo=$NAME" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

gh_graphql() { curl -fsS -X POST -H "Authorization: Bearer $TOKEN" https://api.github.com/graphql -d "$1"; }
gh_rest()    { curl -fsS -H "Authorization: Bearer $TOKEN" "https://api.github.com/$1"; }

run_count() { gh_rest "repos/$REPO/actions/runs?head_sha=$1" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["total_count"])'; }

# Query bodies are built with printf rather than a nested heredoc: a heredoc
# inside command substitution silently yields an empty body here.
queue_query() { # $1 = node field selection
  printf '{"query":"query{repository(owner:\\"%s\\",name:\\"%s\\"){mergeQueue(branch:\\"%s\\"){entries(first:50){nodes{%s}}}}}"}' \
    "$OWNER" "$NAME" "$BRANCH" "$1"
}

log "repo=$REPO branch=$BRANCH grace=${GRACE_SECONDS}s apply=$APPLY"

ENTRIES="$(gh_graphql "$(queue_query 'state enqueuedAt enqueuer{login} headCommit{oid} pullRequest{number id state reviewDecision mergeStateStatus}')")"

# One TSV line per entry that is genuinely wedged and safe to touch.
# Passed through the environment, not a pipe: a heredoc-sourced program takes
# over stdin, so piped data would never reach it.
WEDGED="$(GRACE="$GRACE_SECONDS" DEAD="$DEAD_ENQUEUER" ENTRIES_JSON="$ENTRIES" python3 <<'PYEOF'
import json, os, sys, datetime
grace = int(os.environ["GRACE"]); dead = os.environ["DEAD"]
now = datetime.datetime.now(datetime.timezone.utc)
q = json.loads(os.environ["ENTRIES_JSON"])["data"]["repository"]["mergeQueue"]
for e in (q["entries"]["nodes"] if q else []):
    pr = e["pullRequest"]; oid = (e["headCommit"] or {}).get("oid")
    # Stay quiet unless every precondition holds: a false positive dequeues a
    # healthy PR that may be seconds from merging.
    if e["state"] != "AWAITING_CHECKS" or not oid: continue
    if (e["enqueuer"] or {}).get("login") != dead: continue
    if pr["state"] != "OPEN" or pr["reviewDecision"] != "APPROVED": continue
    if pr["mergeStateStatus"] not in ("CLEAN", "HAS_HOOKS"): continue
    age = (now - datetime.datetime.fromisoformat(e["enqueuedAt"].replace("Z", "+00:00"))).total_seconds()
    if age < grace: continue
    print("%s\t%s\t%s\t%d" % (pr["number"], pr["id"], oid, age))
PYEOF
)"

if [ -z "$WEDGED" ]; then log "no wedged entries; nothing to do"; exit 0; fi

RESCUED=""
while IFS=$'\t' read -r NUM ID OID AGE; do
  [ -z "$NUM" ] && continue
  # Zero runs on the group commit is the definitive tell, so confirm it against
  # the API rather than trusting the enqueuer heuristic alone.
  BEFORE="$(run_count "$OID")"
  if [ "$BEFORE" -gt 0 ]; then
    log "PR #$NUM group ${OID:0:10} has $BEFORE runs -- alive, skipping"; continue
  fi
  log "PR #$NUM WEDGED: enqueued by $DEAD_ENQUEUER ${AGE}s ago, group ${OID:0:10} has 0 runs"
  if [ "$APPLY" -eq 0 ]; then log "  (dry run -- pass --apply to rescue)"; continue; fi

  gh_graphql "{\"query\":\"mutation{dequeuePullRequest(input:{id:\\\"$ID\\\"}){mergeQueueEntry{state}}}\"}" >/dev/null
  ENQ="$(gh_graphql "{\"query\":\"mutation{enqueuePullRequest(input:{pullRequestId:\\\"$ID\\\"}){mergeQueueEntry{position state enqueuer{login}}}}\"}")"
  WHO="$(printf '%s' "$ENQ" | python3 -c 'import json,sys; e=json.load(sys.stdin).get("data",{}).get("enqueuePullRequest") or {}; print(((e.get("mergeQueueEntry") or {}).get("enqueuer") or {}).get("login","?"))')"
  if [ "$WHO" = "$DEAD_ENQUEUER" ] || [ "$WHO" = "?" ]; then
    log "  FAILED: re-enqueued as '$WHO' -- broker token is not an App identity, aborting"; exit 1
  fi
  log "  re-enqueued as $WHO"
  RESCUED="$RESCUED $NUM"
done <<EOF
$WEDGED
EOF

[ "$APPLY" -eq 0 ] && exit 0
[ -z "$RESCUED" ] && { log "nothing rescued"; exit 0; }

# A re-enqueue that produces another runless group is not a rescue. Confirm.
log "waiting for merge-group workflow runs on rescued entries..."
sleep 45
FRESH="$(gh_graphql "$(queue_query 'pullRequest{number} headCommit{oid}')")"
FAIL=0
for NUM in $RESCUED; do
  OID="$(printf '%s' "$FRESH" | NUM="$NUM" python3 -c 'import json,os,sys
n=int(os.environ["NUM"]); q=json.load(sys.stdin)["data"]["repository"]["mergeQueue"]
print(next((((e["headCommit"] or {}).get("oid","")) for e in q["entries"]["nodes"] if e["pullRequest"]["number"]==n),""))')"
  if [ -z "$OID" ]; then log "PR #$NUM: left the queue (merged or dequeued)"; continue; fi
  N="$(run_count "$OID")"
  if [ "$N" -gt 0 ]; then log "PR #$NUM: group ${OID:0:10} has $N runs -- ALIVE"
  else log "PR #$NUM: group ${OID:0:10} STILL has 0 runs -- rescue did not take"; FAIL=1; fi
done
exit "$FAIL"
